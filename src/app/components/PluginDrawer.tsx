/**
 * PluginDrawer.tsx
 * Phase 2 & 3: Interactive UI Modal & Drawer for Dream-It Plugins & MCP Servers.
 * Allows users to toggle in-app plugins (Web Search, Finance Ticker, Math Solver, Notes)
 * and manage external Model Context Protocol (MCP) server integrations.
 */

import React, { useState, useEffect } from "react";
import {
  Globe,
  TrendingUp,
  Calculator,
  BookOpen,
  Calendar,
  Cpu,
  X,
  Check,
  Plus,
  RefreshCw,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  Server,
  Zap,
  Trash2,
} from "lucide-react";
import {
  DreamPlugin,
  getSavedPlugins,
  savePluginState,
  BUILT_IN_PLUGINS,
} from "../../lib/plugins";
import {
  MCPServerConfig,
  getSavedMCPServers,
  saveMCPServers,
  testMCPServerConnection,
  DEFAULT_MCP_PRESETS,
} from "../../lib/mcp-client";

interface PluginDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onPluginsChange?: (plugins: DreamPlugin[]) => void;
}

export const PluginDrawer: React.FC<PluginDrawerProps> = ({
  isOpen,
  onClose,
  onPluginsChange,
}) => {
  const [activeTab, setActiveTab] = useState<"plugins" | "mcp">("plugins");
  const [plugins, setPlugins] = useState<DreamPlugin[]>([]);
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [testingServerId, setTestingServerId] = useState<string | null>(null);

  // New MCP Server Form state
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [newServerToken, setNewServerToken] = useState("");
  const [newServerType, setNewServerType] = useState<"sse" | "http">("http");

  // Load plugins and MCP servers on mount / open
  useEffect(() => {
    if (isOpen) {
      const loadedPlugins = getSavedPlugins();
      setPlugins(loadedPlugins);
      const loadedMcp = getSavedMCPServers();
      setMcpServers(loadedMcp);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTogglePlugin = (pluginId: string) => {
    setPlugins((prev) => {
      const updated = prev.map((p) =>
        p.id === pluginId ? { ...p, enabled: !p.enabled } : p
      );
      const changed = updated.find((p) => p.id === pluginId);
      if (changed) {
        savePluginState(pluginId, changed.enabled);
      }
      if (onPluginsChange) {
        onPluginsChange(updated);
      }
      return updated;
    });
  };

  const handleToggleMcpServer = (serverId: string) => {
    setMcpServers((prev) => {
      const updated = prev.map((s) =>
        s.id === serverId ? { ...s, enabled: !s.enabled } : s
      );
      saveMCPServers(updated);
      return updated;
    });
  };

  const handleTestMcpServer = async (server: MCPServerConfig) => {
    setTestingServerId(server.id);
    const result = await testMCPServerConnection(server);
    setMcpServers((prev) => {
      const updated = prev.map((s) =>
        s.id === server.id
          ? {
            ...s,
            lastPingStatus: result.ok ? ("online" as const) : ("offline" as const),
            lastPingTime: Date.now(),
            discoveredTools: result.tools,
            error: result.error,
          }
          : s
      );
      saveMCPServers(updated);
      return updated;
    });
    setTestingServerId(null);
  };

  const handleAddMcpServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim() || !newServerUrl.trim()) return;

    const newServer: MCPServerConfig = {
      id: `mcp_${Date.now()}`,
      name: newServerName.trim(),
      url: newServerUrl.trim(),
      authToken: newServerToken.trim() || undefined,
      type: newServerType,
      enabled: true,
      lastPingStatus: "untested",
      discoveredTools: [],
    };

    const updated = [...mcpServers, newServer];
    setMcpServers(updated);
    saveMCPServers(updated);
    setShowAddServer(false);
    setNewServerName("");
    setNewServerUrl("");
    setNewServerToken("");

    // Auto-ping the newly added server
    handleTestMcpServer(newServer);
  };

  const handleDeleteMcpServer = (serverId: string) => {
    const updated = mcpServers.filter((s) => s.id !== serverId);
    setMcpServers(updated);
    saveMCPServers(updated);
  };

  const getPluginIcon = (iconName: string) => {
    switch (iconName) {
      case "Globe":
        return <Globe className="size-5 text-blue-400" />;
      case "TrendingUp":
        return <TrendingUp className="size-5 text-emerald-400" />;
      case "Calculator":
        return <Calculator className="size-5 text-purple-400" />;
      case "BookOpen":
        return <BookOpen className="size-5 text-amber-400" />;
      case "Calendar":
        return <Calendar className="size-5 text-pink-400" />;
      case "Cpu":
        return <Cpu className="size-5 text-cyan-400" />;
      default:
        return <Zap className="size-5 text-primary" />;
    }
  };

  const activePluginsCount = plugins.filter((p) => p.enabled).length;
  const activeMcpCount = mcpServers.filter((s) => s.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all"
        style={{
          backgroundColor: "var(--m-card, #121316)",
          borderColor: "var(--m-border, rgba(255,255,255,0.1))",
          color: "var(--m-text, #fff)",
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--m-border, rgba(255,255,255,0.08))" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Dream It Plugins & Integrations
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                  Model Context Protocol
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Ground AI responses with live web browsing, smart apps, and your custom MCP tools
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition text-muted-foreground hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          className="flex items-center gap-2 px-6 pt-3 border-b"
          style={{ borderColor: "var(--m-border, rgba(255,255,255,0.08))" }}
        >
          <button
            onClick={() => setActiveTab("plugins")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition ${activeTab === "plugins"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-white"
              }`}
          >
            <Layers className="size-4" />
            Built-in Plugins
            <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px]">
              {activePluginsCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("mcp")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition ${activeTab === "mcp"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-white"
              }`}
          >
            <Server className="size-4" />
            MCP Servers (Model Context Protocol)
            <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px]">
              {activeMcpCount}
            </span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "plugins" ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
                <Globe className="size-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Active AI Tools:</strong> Live Web Search, CoinGecko Financial Ticker, and KaTeX Math Engine run automatically when relevant prompts are detected.
                </span>
              </div>

              {plugins.map((plugin) => (
                <div
                  key={plugin.id}
                  className="flex items-center justify-between p-4 rounded-xl border transition hover:border-white/20"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderColor: plugin.enabled
                      ? "rgba(99, 102, 241, 0.3)"
                      : "var(--m-border, rgba(255,255,255,0.08))",
                  }}
                >
                  <div className="flex items-start gap-3.5 flex-1 pr-4">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
                      {getPluginIcon(plugin.icon)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{plugin.name}</span>
                        {plugin.badge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-muted-foreground">
                            {plugin.badge}
                          </span>
                        )}
                        {plugin.enabled && (
                          <span className="size-2 rounded-full bg-emerald-400"></span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {plugin.description}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleTogglePlugin(plugin.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${plugin.enabled ? "bg-emerald-500" : "bg-white/20"
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${plugin.enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 flex items-start gap-2.5">
                <Cpu className="size-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Model Context Protocol (MCP) Standard:</strong> Connect external tools and apps (Notion, GitHub, Google Drive, or local dev servers) via JSON-RPC 2.0. The AI dynamically discovers and invokes tools exposed by your connected servers.
                </span>
              </div>

              {/* Empty State (Default - like ChatGPT / Claude Desktop) */}
              {mcpServers.length === 0 && !showAddServer ? (
                <div className="p-8 rounded-2xl border border-dashed border-white/15 text-center flex flex-col items-center justify-center space-y-3.5 bg-white/[0.01]">
                  <div className="size-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 grid place-items-center text-purple-400 shadow-inner">
                    <Server className="size-6" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="text-sm font-bold text-white">No MCP Servers Connected</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      You haven&apos;t added any Model Context Protocol servers yet. Connect your custom servers, local developer tools, or workspace endpoints so Dream It AI can query external data.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddServer(true)}
                    className="mt-1 px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 transition flex items-center gap-2 hover:scale-105"
                  >
                    <Plus className="size-4" />
                    <span>Add MCP Server</span>
                  </button>

                  {/* Quick Starter Templates */}
                  <div className="pt-4 mt-2 border-t border-white/10 w-full max-w-md">
                    <div className="text-[11px] text-muted-foreground font-medium mb-2.5 text-center">
                      Need inspiration? Start from a template:
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {DEFAULT_MCP_PRESETS.map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => {
                            setNewServerName(preset.name);
                            setNewServerUrl(preset.url);
                            setNewServerType(preset.type);
                            setShowAddServer(true);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/40 text-purple-300 transition flex items-center gap-1.5"
                        >
                          <Plus className="size-3" />
                          <span>{preset.name.split(" ")[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Configured Server List */
                <div className="space-y-3">
                  {mcpServers.map((server) => (
                    <div
                      key={server.id}
                      className="p-4 rounded-xl border transition"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.02)",
                        borderColor: server.enabled
                          ? "rgba(168, 85, 247, 0.3)"
                          : "var(--m-border, rgba(255,255,255,0.08))",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`size-2 rounded-full ${server.lastPingStatus === "online"
                                ? "bg-emerald-400 animate-pulse"
                                : server.lastPingStatus === "offline"
                                  ? "bg-rose-400"
                                  : "bg-amber-400/80"
                              }`}
                          />
                          <span className="text-sm font-semibold">{server.name}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">
                            {server.type}
                          </span>
                          {server.lastPingStatus === "online" && (
                            <span className="text-[10px] font-mono text-emerald-400">
                              Online {server.lastPingTime ? "" : ""}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestMcpServer(server)}
                            disabled={testingServerId === server.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`size-3 ${testingServerId === server.id ? "animate-spin" : ""
                                }`}
                            />
                            {testingServerId === server.id ? "Testing..." : "Test Ping"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleMcpServer(server.id)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${server.enabled ? "bg-purple-600" : "bg-white/20"
                              }`}
                            title={server.enabled ? "Disable server" : "Enable server"}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-200 ${server.enabled ? "translate-x-4" : "translate-x-0"
                                }`}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteMcpServer(server.id)}
                            className="p-1 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition"
                            title="Delete MCP Server"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 text-xs font-mono text-muted-foreground truncate">
                        {server.url}
                      </div>

                      {/* Discovered Tools Pill list */}
                      {server.discoveredTools && server.discoveredTools.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-white/5">
                          <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
                            Discovered MCP Tools ({server.discoveredTools.length}):
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {server.discoveredTools.map((tool) => (
                              <span
                                key={tool.name}
                                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20"
                                title={tool.description}
                              >
                                ⚡ {tool.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Another MCP Server Button */}
                  {!showAddServer && (
                    <button
                      type="button"
                      onClick={() => setShowAddServer(true)}
                      className="w-full py-3 rounded-xl border border-dashed border-white/20 hover:border-purple-400/50 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-white/5 transition text-purple-300"
                    >
                      <Plus className="size-4" />
                      Connect Another MCP Server (Endpoint URL)
                    </button>
                  )}
                </div>
              )}

              {/* Add New MCP Server Form */}
              {showAddServer && (
                <form
                  onSubmit={handleAddMcpServer}
                  className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                    <span>Add Model Context Protocol Server</span>
                    <button
                      type="button"
                      onClick={() => setShowAddServer(false)}
                      className="text-muted-foreground hover:text-white"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">
                        Server Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. My Workspace MCP"
                        value={newServerName}
                        onChange={(e) => setNewServerName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs focus:outline-none focus:border-purple-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">
                        Transport Protocol
                      </label>
                      <select
                        value={newServerType}
                        onChange={(e) => setNewServerType(e.target.value as "sse" | "http")}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs focus:outline-none focus:border-purple-400 text-white"
                      >
                        <option value="http">HTTP (JSON-RPC 2.0)</option>
                        <option value="sse">SSE (Server-Sent Events)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      Endpoint URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://mcp.myhost.com/v1 or http://localhost:3001/sse"
                      value={newServerUrl}
                      onChange={(e) => setNewServerUrl(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs focus:outline-none focus:border-purple-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      Bearer / API Token (Optional)
                    </label>
                    <input
                      type="password"
                      placeholder="Optional authorization token"
                      value={newServerToken}
                      onChange={(e) => setNewServerToken(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddServer(false)}
                      className="px-3 py-1.5 rounded-lg text-xs hover:bg-white/10 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition"
                    >
                      Connect & Save
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="flex items-center justify-between px-6 py-3 border-t bg-white/[0.02]"
          style={{ borderColor: "var(--m-border, rgba(255,255,255,0.08))" }}
        >
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Shield className="size-3.5 text-emerald-400" />
            <span>Active tools are safely isolated and auto-grounded.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
