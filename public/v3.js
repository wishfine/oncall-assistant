(function () {
  var q = document.getElementById("query");
  var btn = document.getElementById("send-btn");
  var statusEl = document.getElementById("status");
  var historyEl = document.getElementById("chat-history");

  // Track conversation for multi-turn context
  var chatHistory = [];

  function esc(s) {
    if (s === null || s === undefined) return "";
    var el = document.createElement("span");
    el.textContent = String(s);
    return el.innerHTML;
  }

  function renderToolCalls(calls) {
    if (!calls || !calls.length) return "";

    var steps = calls.map(function (tc, i) {
      var reasonHtml = tc.reason
        ? '<div class="tool-reason">Reason: ' + esc(tc.reason) + "</div>"
        : "";
      return (
        '<div class="tool-call">' +
        '<div class="tool-step">' +
        '<span class="tool-step-num">' +
        (i + 1) +
        "</span>" +
        '<span class="tool-name">' +
        esc(tc.tool) +
        "</span>" +
        "</div>" +
        '<div class="tool-args">fname: ' +
        esc(tc.args.fname) +
        "</div>" +
        reasonHtml +
        '<div class="tool-obs">' +
        esc(tc.observation) +
        "</div>" +
        "</div>"
      );
    }).join("");

    return (
      '<div class="tool-calls-section">' +
      '<div class="tool-calls-header">' +
      "🔧 工具调用过程 (" +
      calls.length +
      " 步)" +
      "</div>" +
      '<div class="tool-calls-body">' +
      steps +
      "</div>" +
      "</div>"
    );
  }

  function renderSources(sources) {
    if (!sources || !sources.length) return "";
    return (
      '<div class="sources">📄 来源：' +
      sources
        .map(function (s) {
          return '<span class="source-tag">' + esc(s) + "</span>";
        })
        .join(" ") +
      "</div>"
    );
  }

  function addMessage(role, content, toolCalls, sources) {
    var div = document.createElement("div");
    div.className = "chat-msg " + role;

    var roleLabel = role === "user" ? "🧑 你" : "🤖 Agent";

    var html = '<div class="msg-role">' + roleLabel + "</div>";

    if (toolCalls && toolCalls.length) {
      html += renderToolCalls(toolCalls);
    }

    html += '<div class="msg-content">' + esc(content) + "</div>";
    html += renderSources(sources);

    div.innerHTML = html;
    historyEl.appendChild(div);
    div.scrollIntoView({ behavior: "smooth" });
  }

  async function send() {
    var message = q.value.trim();
    if (!message) return;

    addMessage("user", message, null, null);
    chatHistory.push({ role: "user", content: message });
    q.value = "";
    q.disabled = true;
    btn.disabled = true;
    statusEl.innerHTML = '<div class="loading">Agent 思考中…</div>';

    try {
      var body = { message: message };
      if (chatHistory.length > 1) {
        body.history = chatHistory.slice(0, -1); // exclude current message
      }

      var resp = await fetch("/v3/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      var data = await resp.json();
      statusEl.innerHTML = "";
      addMessage("agent", data.answer, data.toolCalls, data.sources);
      chatHistory.push({ role: "assistant", content: data.answer });
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
    var header = e.target.closest(".tool-calls-header");
    if (!header) return;
    var body = header.nextElementSibling;
    if (body) body.hidden = !body.hidden;
  });
})();
