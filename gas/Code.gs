/**
 * お問い合わせをスプレッドシートへ保存する Google Apps Script
 *
 * このファイルをスプレッドシート側へコピーし、ウェブアプリとしてデプロイしたあと、
 * 発行された /exec のURLを js/site-config.js の contactEndpoint に設定してください。
 * URLを入れるまでは、サイトの送信ボタンは無効のままです。
 *
 * ── 保存先 ──────────────────────────────────────────────
 * スプレッドシートID: 1LyVtD_Dv7EhNxHb6kCADr4axz7B9Nh9XMphNjg0DO54
 * 対象シートの gid: 1044106015
 *
 * 列の中身はこちらから確認できませんでした。既存の列は変更しません。
 * 次の見出しが1行目 A〜F と完全に一致するときだけ、最終行の次へ追加します。
 *
 *   A 受付日時
 *   B お名前
 *   C 事業者名
 *   D メールアドレス
 *   E お問い合わせ種別
 *   F ご相談内容
 *
 * 1行目が空のシートなら、最初の送信時にこの見出しを書き、2行目から受付します。
 * 1行目が別の見出しのときは何も書き込まず、エラーを返します。
 * 既存行の削除、上書き、列の並べ替えはしません。
 *
 * ── デプロイ手順 ────────────────────────────────────────
 * 1. 対象のスプレッドシートを開く。
 * 2. 共有設定は「制限付き」のままにする。ウェブアプリを公開しても、
 *    シート自体を「リンクを知っている全員」にはしない。
 * 3. メニューの「拡張機能」→「Apps Script」を開く。
 * 4. すでに別のコードがある場合は、消さずに作業を止める。
 *    初期状態の function myFunction() だけなら、その内容をこのファイル全体と置き換える。
 * 5. 保存する。
 * 6. 1行目が空で、先に見出しだけ置きたい場合は、関数 setupHeaders を選んで実行する。
 *    シートに何か書かれているときは、この関数は見出しを書きません。
 * 7. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」。
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員
 *      （「Googleアカウントを持つ全員」ではない。訪問者はログインしません）
 * 8. アクセスを許可する。表示される権限は、このスクリプトが自分のスプレッドシートへ
 *    行を追加するためのものです。訪問者にシートの閲覧や編集は開きません。
 * 9. 表示されたウェブアプリURLをコピーする。末尾は /exec。/dev は使わない。
 * 10. js/site-config.js の contactEndpoint に、そのURLだけを貼る。
 * 11. サイトを再度公開すると、送信ボタンが有効になる。
 *
 * 動作確認は、テスト用の短い相談を1件送り、指定シートの最終行に増えていることと、
 * それより上の行が残っていることを見てください。
 * GETでURLを開いても、保存済みの問い合わせは返しません。
 */

var SPREADSHEET_ID = "1LyVtD_Dv7EhNxHb6kCADr4axz7B9Nh9XMphNjg0DO54";
var TARGET_GID = 1044106015;
var HEADERS = ["受付日時", "お名前", "事業者名", "メールアドレス", "お問い合わせ種別", "ご相談内容"];
var INQUIRY_TYPES = [
  "ホームページ制作について",
  "LP制作について",
  "既存サイトの改善について",
  "AI活用について",
  "SNS運用について",
  "その他"
];

function doGet() {
  return json_({ ok: false, error: "method" });
}

function doPost(e) {
  try {
    return json_(handlePost_(e));
  } catch (error) {
    return json_({ ok: false, error: "failed" });
  }
}

/**
 * シートが完全に空のときだけ、提案した見出しを1行目へ書きます。
 * エディタから手動実行するための関数です。フォーム送信では自動では呼びません。
 */
function setupHeaders() {
  var sheet = openTargetSheet_();
  if (!sheet) {
    throw new Error("指定したgidのシートが見つかりません。新しいシートは作成しません。");
  }
  if (sheet.getLastRow() !== 0) {
    throw new Error("シートに既存の内容があるため、見出しは書き込みませんでした。");
  }
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
}

function handlePost_(e) {
  var data = readJson_(e);
  if (!data) return { ok: false, error: "validation" };

  if (typeof data.hp_field === "string" && data.hp_field.trim() !== "") {
    return { ok: false, error: "spam" };
  }
  if (data.hp_field && typeof data.hp_field !== "string") {
    return { ok: false, error: "spam" };
  }

  var started = Number(data.startedAt);
  var elapsed = Date.now() - started;
  if (!isFinite(started) || elapsed < 2000 || elapsed > 24 * 60 * 60 * 1000) {
    return { ok: false, error: "spam" };
  }

  var name = requiredText_(data.name, 80);
  var business = optionalText_(data.business, 120);
  var email = requiredText_(data.email, 254);
  var type = requiredText_(data.type, 40);
  var message = requiredText_(data.message, 4000);
  if (name === null || business === null || email === null || type === null || message === null) {
    return { ok: false, error: "validation" };
  }
  if (hasControls_(name) || hasControls_(business) || hasControls_(email) || hasControls_(type)) {
    return { ok: false, error: "validation" };
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(message)) {
    return { ok: false, error: "validation" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "validation" };
  }
  if (INQUIRY_TYPES.indexOf(type) === -1) {
    return { ok: false, error: "validation" };
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: "busy" };

  try {
    var cache = CacheService.getScriptCache();
    var cacheKey = digestKey_(email, type, message);
    if (cache.get(cacheKey)) return { ok: false, error: "duplicate" };

    var sheet = openTargetSheet_();
    if (!sheet) return { ok: false, error: "sheet" };
    var createdHeader = false;
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      createdHeader = true;
    } else if (!headersMatch_(sheet)) {
      return { ok: false, error: "headers" };
    }

    var stamp = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
    var row = [
      asText_(stamp),
      asText_(name),
      asText_(business),
      asText_(email),
      asText_(type),
      asText_(message)
    ];
    var rowIndex = createdHeader ? 2 : sheet.getLastRow() + 1;
    if (rowIndex > 2 && isSameInquiry_(sheet, rowIndex - 1, row)) {
      return { ok: false, error: "duplicate" };
    }

    var range = sheet.getRange(rowIndex, 1, 1, HEADERS.length);
    range.setNumberFormat("@");
    range.setValues([row]);
    cache.put(cacheKey, "1", 120);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function openTargetSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === TARGET_GID) return sheets[i];
  }
  return null;
}

function headersMatch_(sheet) {
  var current = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  for (var i = 0; i < HEADERS.length; i++) {
    if (String(current[i]).trim() !== HEADERS[i]) return false;
  }
  return true;
}

function isSameInquiry_(sheet, rowIndex, row) {
  var prev = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
  for (var i = 1; i < HEADERS.length; i++) {
    if (String(prev[i]) !== row[i]) return false;
  }
  return true;
}

function readJson_(e) {
  if (!e || !e.postData || !e.postData.contents) return null;
  if (e.postData.contents.length > 20000) return null;
  try {
    var data = JSON.parse(e.postData.contents);
    if (!data || typeof data !== "object" || Object.prototype.toString.call(data) === "[object Array]") {
      return null;
    }
    return data;
  } catch (error) {
    return null;
  }
}

function requiredText_(value, max) {
  if (typeof value !== "string") return null;
  var text = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text || text.length > max) return null;
  return text;
}

function optionalText_(value, max) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") return null;
  var text = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (text.length > max) return null;
  return text;
}

function hasControls_(text) {
  return /[\u0000-\u001F\u007F]/.test(text);
}

function asText_(value) {
  var text = String(value == null ? "" : value);
  if (/^[=+\-@\t\r]/.test(text)) return "'" + text;
  return text;
}

function digestKey_(email, type, message) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    [email.toLowerCase(), type, message].join("\n"),
    Utilities.Charset.UTF_8
  );
  var hex = bytes.map(function (b) {
    var v = (b + 256) % 256;
    return (v < 16 ? "0" : "") + v.toString(16);
  }).join("");
  return "inq_" + hex.slice(0, 40);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
