(function () {
  const q = document.getElementById("query");
  const btn = document.getElementById("search-btn");
  const statusEl = document.getElementById("status");
  const resultsEl = document.getElementById("results");

  function render(results, query) {
    if (!results.length) {
      resultsEl.innerHTML = `<p class="error-msg">未找到与 “${esc(query)}” 语义相关的结果</p>`;
      return;
    }
    resultsEl.innerHTML = results
      .map(
        (r) => `
      <div class="result-card">
        <div class="result-id">${esc(r.id)}</div>
        <div class="result-title">${esc(r.title)}</div>
        <div class="result-snippet">${esc(r.snippet)}</div>
        <div class="result-score">语义相关性：${r.score}</div>
      </div>`,
      )
      .join("");
  }

  function esc(s) {
    const el = document.createElement("span");
    el.textContent = s;
    return el.innerHTML;
  }

  async function search() {
    const query = q.value.trim();
    if (!query) return;

    statusEl.innerHTML = '<span class="loading">语义搜索中…</span>';
    resultsEl.innerHTML = "";

    try {
      const resp = await fetch(
        "/v2/search?q=" + encodeURIComponent(query),
      );
      const data = await resp.json();
      statusEl.innerHTML = "";
      render(data.results, query);
    } catch (e) {
      statusEl.innerHTML =
        '<span class="error-msg">搜索请求失败</span>';
    }
  }

  btn.addEventListener("click", search);
  q.addEventListener("keydown", function (e) {
    if (e.key === "Enter") search();
  });
})();
