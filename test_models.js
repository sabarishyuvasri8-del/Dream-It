const apiKey = "your_api_key_here";
fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + apiKey)
  .then(res => res.json())
  .then(data => {
    if (data.models) {
      console.log(data.models.map(m => m.name).filter(n => n.includes("gemma")));
    } else {
      console.log("Error:", data);
    }
  });
