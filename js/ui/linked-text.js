const WEB_LINK_PATTERN = /https:\/\/[^\s<]+/gi;

function trimTrailingPunctuation(value) {
  let link = value;
  let trailing = "";
  while (/[),.;!?\]}]$/.test(link)) {
    trailing = link.slice(-1) + trailing;
    link = link.slice(0, -1);
  }
  return { link, trailing };
}

export function appendTextWithLinks(element, value, className = "homework-inline-link") {
  const text = String(value ?? "");
  let cursor = 0;
  for (const match of text.matchAll(WEB_LINK_PATTERN)) {
    if (match.index > cursor) element.append(document.createTextNode(text.slice(cursor, match.index)));
    const { link, trailing } = trimTrailingPunctuation(match[0]);
    const anchor = document.createElement("a");
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.className = className;
    anchor.textContent = link;
    element.append(anchor);
    if (trailing) element.append(document.createTextNode(trailing));
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) element.append(document.createTextNode(text.slice(cursor)));
  return element;
}
