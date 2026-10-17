import DOMPurify from "dompurify";

const SAFE_HTML_CONFIG = {
	ALLOWED_TAGS: [
		"a", "b", "blockquote", "br", "code", "del", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6",
		"hr", "i", "img", "li", "ol", "p", "pre", "s", "span", "strong", "sub", "sup", "table", "tbody",
		"td", "th", "thead", "tr", "u", "ul",
	],
	ALLOWED_ATTR: ["alt", "class", "height", "href", "rel", "src", "target", "title", "width"],
	ALLOW_DATA_ATTR: false,
} as const;

export function sanitizeRemoteHtml(html: string | null | undefined): string {
	if (!html) return "";
	return DOMPurify.sanitize(html, { ...SAFE_HTML_CONFIG, ALLOWED_TAGS: [...SAFE_HTML_CONFIG.ALLOWED_TAGS], ALLOWED_ATTR: [...SAFE_HTML_CONFIG.ALLOWED_ATTR] });
}
