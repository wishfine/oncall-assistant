(function () {
  const q = document.getElementById("query");
  const btn = document.getElementById("send-btn");
  const statusEl = document.getElementById("status");
  const historyEl = document.getElementById("chat-history");

  function renderToolCalls(calls) {
    if (!calls || !calls.length) return "";
    return calls
      .map(
        (tc) => `
      <div class="tool-call">
        <div class="tool-name">🔧 ${esc(tc.tool)}</div>
        <div class="tool-args">参数：${esc(JSON.stringify(tc.args))}</div>
        <div class="tool-obs">结果：${esc(tc.observation)}</div>
      </div>`,
      )
      .join("");
  }

  function esc(s) {
    const el = document.createElement("span");
    el.textContent = String(s);
    return el.innerHTML;
  }

  function addMessage(role, content, toolCalls, sources) {
    const div = document.createElement("div");
    div.className = "chat-msg " + role;

    let html = `<div class="result-title">${role === "user" ? "🧑 你" : "🤖 Agent"}</div>`;

    if (toolCalls && toolCalls.length) {
      html += renderToolCalls(toolCalls);
    }

    html += `<div class="result-snippet">${esc(content) || ""}</div>`;

    if (sources && sources.length) {
      html += `<div class="sources">📄 来源：${esc(sources.join(", "))}</div>`;
    }

    div.innerHTML = html;
    historyEl.appendChild(div);
    div.scrollIntoView({ behavior: "smooth" });
  }

  async function send() {
    const message = q.value.trim();
    if (!message) return;

    addMessage("user", message, null, null);
    q.value = "";
    statusEl.innerHTML = '<span class="loading">Agent 思考中…</span>';

    try {
      const resp = await fetch("/v3/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await resp.json();
      statusEl.innerHTML = "";
      addMessage("agent", data.answer, data.toolCalls, data.sources);
    } catch (e) {
      statusEl.innerHTML =
        '<span class="error-msg">请求失败，请检查服务状态</span>';
    }
  }

  btn.addEventListener("click", send);
  q.addEventListener("keydown", function (e) {
    if (e.key === "Enter") send();
  });
})();
