(function () {
  const q = document.getElementById("query");
  const btn = document.getElementById("send-btn");
  const statusEl = document.getElementById("status");
  const historyEl = document.getElementById("chat-history");

  function esc(s) {
    if (s === null || s === undefined) return "";
    const el = document.createElement("span");
    el.textContent = String(s);
    return el.innerHTML;
  }

  function renderToolCalls(calls) {
    if (!calls || !calls.length) return "";

    const steps = calls
      .map(
        (tc, i) => `
      <div class="tool-call">
        <div class="tool-step">
          <span class="tool-step-num">${i + 1}</span>
          <span class="tool-name">${esc(tc.tool)}</span>
        </div>
        <div class="tool-args">fname: ${esc(tc.args.fname)}</div>
        <div class="tool-obs">${esc(tc.observation)}</div>
      </div>`,
      )
      .join("");

    return `
      <div class="tool-calls-section">
        <div class="tool-calls-header">
          🔧 工具调用过程 (${calls.length} 步)
        </div>
        <div class="tool-calls-body">${steps}</div>
      </div>`;
  }

  function renderSources(sources) {
    if (!sources || !sources.length) return "";
    return `
      <div class="sources">
        📄 来源：
        ${sources.map((s) => `<span class="source-tag">${esc(s)}</span>`).join(" ")}
      </div>`;
  }

  function addMessage(role, content, toolCalls, sources) {
    const div = document.createElement("div");
    div.className = "chat-msg " + role;

    const roleLabel = role === "user" ? "🧑 你" : "🤖 Agent";

    let html = `<div class="msg-role">${roleLabel}</div>`;

    if (toolCalls && toolCalls.length) {
      html += renderToolCalls(toolCalls);
    }

    html += `<div class="msg-content">${esc(content)}</div>`;
    html += renderSources(sources);

    div.innerHTML = html;
    historyEl.appendChild(div);
    div.scrollIntoView({ behavior: "smooth" });
  }

  async function send() {
    const message = q.value.trim();
    if (!message) return;

    addMessage("user", message, null, null);
    q.value = "";
    q.disabled = true;
    btn.disabled = true;
    statusEl.innerHTML = '<div class="loading">Agent 思考中…</div>';

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
        '<div class="error-msg">请求失败，请检查服务状态</div>';
    } finally {
      q.disabled = false;
      btn.disabled = false;
      q.focus();
    }
  }

  btn.addEventListener("click", send);
  q.addEventListener("keydown", function (e) {
    if (e.key === "Enter") send();
  });

  // Delegate tool-calls toggle to chat history
  historyEl.addEventListener("click", function (e) {
    const header = e.target.closest(".tool-calls-header");
    if (!header) return;
    const body = header.nextElementSibling;
    if (body) body.hidden = !body.hidden;
  });
})();
