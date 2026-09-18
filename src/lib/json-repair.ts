/**
 * json-repair.ts
 * Robust JSON parser and repair engine for AI-generated structured outputs.
 * Handles markdown fences, raw unescaped newlines in string literals,
 * unescaped quotes, trailing commas, and token-truncated partial JSON.
 */

/**
 * Attempts to repair and parse potentially malformed or truncated JSON from LLMs.
 */
export function safeParseJSON<T = any>(raw: string, fallback?: T): T {
  if (!raw || typeof raw !== "string") {
    if (fallback !== undefined) return fallback;
    throw new Error("Empty input provided to safeParseJSON");
  }

  // 1. Clean markdown code fences and whitespace
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "").trim();
  }

  // 2. Direct attempt first (cleanest & fastest)
  try {
    return JSON.parse(text) as T;
  } catch {
    // Proceed to repair pipelines
  }

  // 3. Extract boundary: find first '{' or '[' and last '}' or ']'
  const firstCurly = text.indexOf("{");
  const firstSquare = text.indexOf("[");
  let startIndex = -1;
  let isObject = true;

  if (firstCurly !== -1 && (firstSquare === -1 || firstCurly < firstSquare)) {
    startIndex = firstCurly;
    isObject = true;
  } else if (firstSquare !== -1) {
    startIndex = firstSquare;
    isObject = false;
  }

  if (startIndex !== -1) {
    const endChar = isObject ? "}" : "]";
    const lastIndex = text.lastIndexOf(endChar);
    if (lastIndex > startIndex) {
      text = text.substring(startIndex, lastIndex + 1);
    } else {
      text = text.substring(startIndex);
    }
  }

  // Direct attempt after boundary extraction
  try {
    return JSON.parse(text) as T;
  } catch {
    // Continue repairing
  }

  // 4. Sanitize unescaped control characters inside string literals
  text = sanitizeJsonStrings(text);
  try {
    return JSON.parse(text) as T;
  } catch {
    // Continue repairing
  }

  // 5. Fix trailing commas (e.g. `[1, 2, ]` or `{"a": 1, }`)
  text = text.replace(/,\s*([\]}])/g, "$1");
  try {
    return JSON.parse(text) as T;
  } catch {
    // Continue repairing
  }

  // 6. Repair truncated JSON (unclosed strings, brackets, and braces)
  const repaired = repairTruncatedJson(text);
  try {
    return JSON.parse(repaired) as T;
  } catch (err: any) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Failed to parse AI JSON response: ${err?.message || "Invalid JSON syntax"}`);
  }
}

/**
 * Escapes unescaped newlines, tabs, and invalid quotes inside string values.
 */
function sanitizeJsonStrings(str: string): string {
  let result = "";
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (inString) {
      if (isEscaped) {
        result += char;
        isEscaped = false;
      } else if (char === "\\") {
        result += char;
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
        result += char;
      } else if (char === "\n") {
        result += "\\n";
      } else if (char === "\r") {
        result += "\\r";
      } else if (char === "\t") {
        result += "\\t";
      } else {
        result += char;
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }

  return result;
}

/**
 * Closes unclosed quotes, objects ({), and arrays ([) caused by LLM token truncations.
 */
function repairTruncatedJson(str: string): string {
  let text = str.trim();
  const stack: string[] = [];
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === "{" || char === "[") {
        stack.push(char);
      } else if (char === "}") {
        if (stack.length > 0 && stack[stack.length - 1] === "{") {
          stack.pop();
        }
      } else if (char === "]") {
        if (stack.length > 0 && stack[stack.length - 1] === "[") {
          stack.pop();
        }
      }
    }
  }

  // If ended while inside an open string, close it
  if (inString) {
    text += '"';
  }

  // Remove any trailing dangling comma or colon before closing brackets
  text = text.replace(/[,:\s]+$/, "");

  // Close remaining open brackets and braces in reverse order
  while (stack.length > 0) {
    const open = stack.pop();
    if (open === "{") {
      text += "}";
    } else if (open === "[") {
      text += "]";
    }
  }

  return text;
}
