import * as cheerio from "cheerio";
import type { DocumentRecord } from "../types";

export function parseHtmlDocument(
  id: string,
  filename: string,
  html: string,
): DocumentRecord {
  const $ = cheerio.load(html, { decodeEntities: true }, false);

  // Remove non-content elements before extracting text
  $("script, style, noscript, template").remove();
  $("[style*='display:none'], [style*='display: none']").remove();

  // Extract title: <title> first, then <h1>, fallback to id
  let title = $.root().find("title").first().text().trim();
  if (!title) {
    title = $.root().find("h1").first().text().trim();
  }
  if (!title) {
    title = id;
  }

  // Extract visible text from body, fallback to whole document
  const bodyEl = $("body");
  let text = (bodyEl.length > 0 ? bodyEl.text() : $.root().text()) || "";

  // Normalize whitespace
  text = text
    .replace(/\t/g, " ")
    .replace(/ +/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^ *\n/gm, "")
    .trim();

  return { id, filename, title, text, html };
}
