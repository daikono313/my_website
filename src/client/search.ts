// /search/ ページのクライアント側検索。DOM は textContent で組み立て、HTML 文字列は使わない
type Item = {
  kind: "articles" | "weekly";
  kindLabel: string;
  url: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  text: string;
};

const norm = (s: string) => s.normalize("NFKC").toLowerCase();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// 本文中の一致箇所の前後を抜き出す
function snippet(text: string, terms: string[]): string {
  const t = norm(text);
  const pos = terms.map((x) => t.indexOf(x)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (pos === undefined) return "";
  const start = Math.max(0, pos - 40);
  return (start > 0 ? "…" : "") + text.slice(start, start + 120) + "…";
}

export async function initSearch() {
  const form = document.querySelector<HTMLFormElement>(".search-form");
  const input = document.querySelector<HTMLInputElement>("#q");
  const status = document.querySelector<HTMLElement>("#search-status");
  const results = document.querySelector<HTMLUListElement>("#search-results");
  if (!form || !input || !status || !results) return;

  const params = new URLSearchParams(location.search);
  input.value = params.get("q") ?? "";
  let tag = params.get("tag") ?? "";
  const kindParam = params.get("kind") ?? "";
  form.querySelectorAll<HTMLInputElement>('input[name="kind"]').forEach((r) => (r.checked = r.value === kindParam));

  status.textContent = "読み込み中…";
  let items: Item[] = [];
  try {
    const res = await fetch("/search-index.json");
    items = (await res.json()) as Item[];
  } catch {
    status.textContent = "検索インデックスを読み込めませんでした。";
    return;
  }

  const render = () => {
    const q = norm(input.value.trim());
    const terms = q.split(/\s+/).filter(Boolean);
    const kind = form.querySelector<HTMLInputElement>('input[name="kind"]:checked')?.value ?? "";

    document.querySelectorAll<HTMLAnchorElement>(".tag-chip").forEach((a) => {
      a.classList.toggle("active", a.dataset.tag === tag);
    });

    const hits = items
      .filter((it) => !kind || it.kind === kind)
      .filter((it) => !tag || it.tags.includes(tag))
      .map((it) => {
        const title = norm(it.title);
        const meta = norm([it.description, ...it.tags].join(" "));
        const body = norm(it.text);
        let score = 0;
        for (const x of terms) {
          if (title.includes(x)) score += 5;
          else if (meta.includes(x)) score += 3;
          else if (body.includes(x)) score += 1;
          else return null; // すべての語を含むものだけ
        }
        return { it, score };
      })
      .filter((h): h is { it: Item; score: number } => h !== null)
      .sort((a, b) => b.score - a.score || b.it.date.localeCompare(a.it.date));

    // URL に検索条件を残し、共有・戻るに対応する
    const next = new URLSearchParams();
    if (input.value.trim()) next.set("q", input.value.trim());
    if (kind) next.set("kind", kind);
    if (tag) next.set("tag", tag);
    history.replaceState(null, "", next.toString() ? `?${next}` : location.pathname);

    results.replaceChildren();
    if (!terms.length && !tag && !kind) {
      status.textContent = `${items.length} 件の記事・レポートから検索できます。`;
      return;
    }
    const cond = [tag && `タグ「${tag}」`, terms.length && `「${input.value.trim()}」`].filter(Boolean).join(" ・ ");
    status.textContent = `${cond || "すべて"}：${hits.length} 件`;
    for (const { it } of hits) {
      const li = el("li");
      li.append(el("time", undefined, it.date));
      const body = el("div");
      const a = el("a", "post-title", it.title);
      a.href = it.url; // 自サイトのインデックス由来の相対 URL のみ
      const kindBadge = el("span", "kind-badge", it.kindLabel);
      body.append(a, kindBadge, el("p", undefined, snippet(it.text, terms) || it.description));
      li.append(body);
      results.append(li);
    }
  };

  let timer: number | undefined;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(render, 120);
  });
  form.addEventListener("change", render);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    render();
  });
  document.querySelectorAll<HTMLAnchorElement>(".tag-chip").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      tag = tag === a.dataset.tag ? "" : (a.dataset.tag ?? "");
      render();
    }),
  );
  render();
}
