// /blog/ のカテゴリ絞り込み。?category=<slug> の記事だけを表示する（hidden 属性の切り替えだけで、HTML は組み立てない）
export function initBlogFilter() {
  const list = document.querySelector<HTMLUListElement>("#blog-list");
  const empty = document.querySelector<HTMLElement>("#blog-empty");
  const chips = document.querySelectorAll<HTMLAnchorElement>(".category-filter a[data-category]");
  if (!list || !empty) return;
  const known = new Set([...chips].map((a) => a.dataset.category ?? ""));

  const apply = (category: string) => {
    if (!known.has(category)) category = "";
    let shown = 0;
    list.querySelectorAll<HTMLLIElement>(":scope > li").forEach((li) => {
      const hit = !category || li.dataset.category === category;
      li.hidden = !hit;
      if (hit) shown++;
    });
    empty.hidden = shown > 0;
    chips.forEach((a) => {
      const active = (a.dataset.category ?? "") === category;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  };

  chips.forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const category = a.dataset.category ?? "";
      history.replaceState(null, "", category ? `?category=${encodeURIComponent(category)}` : location.pathname);
      apply(category);
    }),
  );
  apply(new URLSearchParams(location.search).get("category") ?? "");
}
