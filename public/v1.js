(function () {
  const q = document.getElementById("query");
  const btn = document.getElementById("search-btn");
  const statusEl = document.getElementById("status");
  const resultsEl = document.getElementById("results");

  function esc(s) {
    const el = document.createElement("span");
    el.textContent = String(s);
    return el.innerHTML;
  }

  function render(results, query) {
    if (!results.length) {
      resultsEl.innerHTML = `<div class="empty-state">未找到与 “${esc(query)}” 相关的结果</div>`;
      return;
    }
    resultsEl.innerHTML = results
      .map(
        (r) => `
      <div class="result-card">
        <div class="result-id">${esc(r.id)}</div>
        <div class="result-title">${esc(r.title)}</div>
        <div class="result-snippet">${esc(r.snippet)}</div>
        <div class="result-score">相关性：${r.score}</div>
      </div>`,
      )
      .join("");

    // Show result count
    statusEl.innerHTML = `<span style="color:var(--text-secondary);font-size:0.85rem">找到 ${results.length} 条结果</span>`;
  }

  async function search() {
    const query = q.value.trim();
    if (!query) return;

    statusEl.innerHTML = '<div class="loading">搜索中…</div>';
    resultsEl.innerHTML = "";
    q.disabled = true;
    btn.disabled = true;

    try {
      const resp = await fetch(
        "/v1/search?q=" + encodeURIComponent(query),
      );
      const data = await resp.json();
      render(data.results, query);
    } catch (e) {
      statusEl.innerHTML =
        '<div class="error-msg">搜索请求失败，请检查服务状态</div>';
    } finally {
      q.disabled = false;
      btn.disabled = false;
      q.focus();
    }
  }

  btn.addEventListener("click", search);
  q.addEventListener("keydown", function (e) {
    if (e.key === "Enter") search();
  });
})();
