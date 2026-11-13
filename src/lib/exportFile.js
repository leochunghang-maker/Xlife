// Save/share a generated file. In the iOS app a plain <a download> does nothing
// inside WKWebView, so the file is written to the cache directory and handed to
// the native share sheet (Save to Files, AirDrop, Mail...). On the web it
// downloads normally.
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export async function exportTextFile(filename, text, mimeType = "text/plain") {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Filesystem")) {
    const { uri } = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    if (Capacitor.isPluginAvailable("Share")) await Share.share({ title: filename, url: uri });
    return { ok: true, uri };
  }
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true };
}

export function toCsv(rows) {
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((row) => row.map(escape).join(",")).join("\r\n");
}
