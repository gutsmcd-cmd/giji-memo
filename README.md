# 議事メモ（Giji Memo）

会議のあと（または途中）に、自分で書く議事メモ PWA。**AI文字起こしアプリではありません。** 無料・広告なし・ログイン不要・オフライン対応。

## できること

- 会議を作成：タイトル、日付、出席者（自由記入）
- 3つの欄：議題、決定事項、やること（本文＋担当者は任意）
- 過去の会議を開いて編集、削除
- 会議全体をプレーンテキストでコピー
- 表示言語：日本語 / English

内容は IndexedDB にだけ保存され、外部には送られません。

## English

**Giji Memo** is a structured meeting-notes PWA you fill in yourself. It is not an AI transcription app. Each meeting has a title, date, attendees, plus agenda, decisions, and action items (text and an optional owner). Open past meetings to edit or delete them, and copy a whole meeting as plain text. Japanese by default, with an English toggle. Free, no ads, no login, offline. Notes stay in IndexedDB on this device.

## 開発 / Development

```bash
npm install
npm run dev
npm run build
npm run preview
```

Vite + vanilla TypeScript + vite-plugin-pwa（`registerType: 'autoUpdate'`, `base: './'`）。
