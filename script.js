const form = document.querySelector("#scp-form");
const canvas = document.querySelector("#scp-canvas");
const ctx = canvas.getContext("2d");
const download = document.querySelector("#download");
const statusBox = document.querySelector("#number-status");
const previewBadge = document.querySelector("#preview-badge");

let validationData = {
  blockedRanges: [{ start: 1, end: 8999, reason: "This number is inside the established official SCP catalogue range." }],
  warningRanges: [{ start: 9000, end: 9999, reason: "This number is in an active SCP series. Double-check before sharing." }],
};

const fields = {
  number: document.querySelector("#scp-number"),
  name: document.querySelector("#scp-name"),
  objectClass: document.querySelector("#object-class"),
  clearance: document.querySelector("#clearance"),
  site: document.querySelector("#site"),
  containment: document.querySelector("#containment"),
  description: document.querySelector("#description"),
  addendum: document.querySelector("#addendum"),
};

function padNumber(value) {
  return String(Math.max(1, Number(value) || 1)).padStart(3, "0");
}

function getData() {
  return {
    number: Number(fields.number.value),
    item: `SCP-${padNumber(fields.number.value)}`,
    name: fields.name.value.trim() || "Untitled Anomaly",
    objectClass: fields.objectClass.value,
    clearance: fields.clearance.value,
    site: fields.site.value.trim() || "Site-19",
    containment: fields.containment.value.trim(),
    description: fields.description.value.trim(),
    addendum: fields.addendum.value.trim(),
  };
}

function findRange(number, ranges) {
  return ranges.find((range) => number >= range.start && number <= range.end);
}

function validateNumber(number) {
  if (!Number.isFinite(number) || number < 1) {
    return { state: "blocked", message: "Enter a valid SCP number above 0." };
  }
  const blocked = findRange(number, validationData.blockedRanges || []);
  if (blocked) return { state: "blocked", message: blocked.reason };
  const warning = findRange(number, validationData.warningRanges || []);
  if (warning) return { state: "warning", message: warning.reason };
  return { state: "valid", message: `${padNumber(number)} looks custom-safe in the local lore validator.` };
}

function updateValidation() {
  const result = validateNumber(Number(fields.number.value));
  statusBox.className = `validation-card ${result.state === "valid" ? "" : result.state}`.trim();
  statusBox.textContent = result.message;
  previewBadge.textContent = result.state === "blocked" ? "BLOCKED" : result.state === "warning" ? "CHECK" : "VALID";
  form.querySelector('button[type="submit"]').disabled = result.state === "blocked";
  return result;
}

function fillBackground() {
  ctx.fillStyle = "#efede3";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(22, 20, 18, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function tokenizeRedactions(text) {
  const tokens = [];
  const pattern = /--([\s\S]*?)--/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(String(text || ""))) !== null) {
    const before = String(text).slice(lastIndex, match.index);
    before.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).forEach((word) => {
      tokens.push({ type: "text", value: word });
    });
    tokens.push({ type: "redaction", value: match[1].trim() || "REDACTED" });
    lastIndex = pattern.lastIndex;
  }
  const after = String(text || "").slice(lastIndex);
  after.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).forEach((word) => {
    tokens.push({ type: "text", value: word });
  });
  return tokens;
}

function drawText(text, x, y, maxWidth, lineHeight, options = {}) {
  const tokens = tokenizeRedactions(text);
  const maxLines = options.maxLines || 999;
  let line = [];
  let lines = 0;

  function tokenWidth(token) {
    if (token.type === "redaction") return Math.min(maxWidth * 0.45, Math.max(86, ctx.measureText(token.value).width + 28));
    return ctx.measureText(token.value).width;
  }

  function lineWidth(parts) {
    return parts.reduce((sum, token, index) => sum + tokenWidth(token) + (index ? ctx.measureText(" ").width : 0), 0);
  }

  function drawLine(parts, lineY) {
    let cursor = x;
    parts.forEach((token, index) => {
      if (index) cursor += ctx.measureText(" ").width;
      if (token.type === "redaction") {
        const width = tokenWidth(token);
        ctx.fillStyle = "#111";
        ctx.fillRect(cursor, lineY - lineHeight + 8, width, lineHeight - 10);
        cursor += width;
        ctx.fillStyle = "#24211d";
      } else {
        ctx.fillText(token.value, cursor, lineY);
        cursor += tokenWidth(token);
      }
    });
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const test = [...line, tokens[i]];
    if (lineWidth(test) > maxWidth && line.length) {
      drawLine(line, y);
      y += lineHeight;
      lines += 1;
      line = [tokens[i]];
      if (lines >= maxLines - 1) {
        const ellipsis = { type: "text", value: "..." };
        while (line.length && lineWidth([...line, ellipsis]) > maxWidth) {
          line.pop();
        }
        drawLine([...line, ellipsis], y);
        return y + lineHeight;
      }
    } else {
      line = test;
    }
  }
  if (line.length) {
    drawLine(line, y);
    y += lineHeight;
  }
  return y;
}

function drawSection(title, body, x, y, width, maxLines) {
  ctx.fillStyle = "#171512";
  ctx.font = "800 28px Georgia, serif";
  ctx.fillText(title, x, y);
  y += 18;
  ctx.strokeStyle = "#171512";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  y += 34;
  ctx.font = "24px Georgia, serif";
  ctx.fillStyle = "#24211d";
  return drawText(body, x, y, width, 34, { maxLines });
}

function drawRedaction(x, y, width, height) {
  ctx.fillStyle = "#111";
  ctx.fillRect(x, y, width, height);
}

function drawScpLogo(x, y, size) {
  const scale = size / 135;
  const outer = new Path2D("m51.9 11.9h31.7l3.07 11.4.944.391c19.4 8.03 32 26.9 32 47.9 0 2.26-.149 4.53-.445 6.77l-.133 1.01 8.37 8.37-15.8 27.4-11.4-3.06-.809.623c-9.06 6.95-20.2 10.7-31.6 10.7-11.4 6e-5-22.5-3.77-31.6-10.7l-.81-.623-11.4 3.06-15.8-27.4 8.37-8.37-.133-1.01c-.296-2.25-.445-4.51-.445-6.77.000141-21 12.6-39.9 32-47.9l.944-.391z");
  const arrow = new Path2D("m64.7 30.6v24h-5.08l8.08 14 8.08-14h-5.08l-.000265-24h-5.99");

  function fillArrow(rotation) {
    ctx.save();
    ctx.translate(67.7, 71.5);
    ctx.rotate(rotation);
    ctx.translate(-67.7, -71.5);
    ctx.fill(arrow);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#171512";
  ctx.fillStyle = "#171512";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.lineWidth = 4;
  ctx.stroke(outer);

  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(67.7, 71.5, 33, 0, Math.PI * 2);
  ctx.stroke();

  fillArrow(0);
  fillArrow((Math.PI * 2) / 3);
  fillArrow((Math.PI * 4) / 3);
  ctx.restore();
}

function renderDocument() {
  const data = getData();
  fillBackground();

  ctx.fillStyle = "#171512";
  ctx.fillRect(70, 72, 1060, 13);
  ctx.fillRect(70, 1510, 1060, 6);

  drawScpLogo(70, 96, 82);

  ctx.font = "900 32px Arial, sans-serif";
  ctx.fillText("SECURE. CONTAIN. PROTECT.", 170, 132);
  ctx.font = "700 19px Arial, sans-serif";
  ctx.fillText("FOUNDATION INTERNAL DOCUMENT", 170, 164);
  ctx.textAlign = "right";
  ctx.font = "800 22px Arial, sans-serif";
  ctx.fillText(data.clearance.toUpperCase(), 1130, 132);
  ctx.fillText(data.site.toUpperCase(), 1130, 164);
  ctx.textAlign = "left";

  ctx.strokeStyle = "#171512";
  ctx.lineWidth = 3;
  ctx.strokeRect(70, 205, 1060, 210);
  ctx.fillStyle = "#171512";
  ctx.font = "900 64px Arial, sans-serif";
  ctx.fillText(data.item, 100, 292);
  ctx.font = "900 42px Arial, sans-serif";
  drawText(data.name, 100, 350, 680, 48, { maxLines: 2 });

  ctx.fillStyle = "#171512";
  ctx.fillRect(820, 230, 280, 56);
  ctx.fillStyle = "#efede3";
  ctx.font = "900 22px Arial, sans-serif";
  ctx.fillText("OBJECT CLASS", 842, 266);
  ctx.fillStyle = "#171512";
  ctx.font = "900 38px Arial, sans-serif";
  ctx.fillText(data.objectClass.toUpperCase(), 842, 337);

  drawRedaction(90, 455, 190, 22);
  drawRedaction(310, 455, 84, 22);
  drawRedaction(420, 455, 156, 22);
  ctx.fillStyle = "#171512";
  ctx.font = "800 20px Arial, sans-serif";
  ctx.fillText("AUTHORISED FILE COPY // DO NOT DISTRIBUTE", 618, 474);

  let y = 540;
  y = drawSection("Special Containment Procedures", data.containment, 90, y, 1020, 8) + 36;
  y = drawSection("Description", data.description, 90, y, 1020, 9) + 36;
  if (data.addendum) {
    y = drawSection("Addendum", data.addendum, 90, y, 1020, 6) + 20;
  }

  ctx.fillStyle = "#171512";
  ctx.globalAlpha = 0.12;
  ctx.font = "900 150px Arial, sans-serif";
  ctx.save();
  ctx.translate(1050, 1390);
  ctx.rotate(-0.18);
  ctx.fillText("CLASSIFIED", -560, 0);
  ctx.restore();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#171512";
  ctx.font = "900 28px Arial, sans-serif";
  ctx.fillText("jakublabs.xyz", 70, 1480);
  ctx.textAlign = "right";
  ctx.font = "700 18px Arial, sans-serif";
  ctx.fillText(`rendered ${new Date().toLocaleDateString("en-GB")}`, 1130, 1480);
  ctx.textAlign = "left";

  updateDownloadLink(data);
}

function updateDownloadLink(data = getData()) {
  download.href = canvas.toDataURL("image/png");
  download.download = `${data.item.toLowerCase()}-document.png`;
}

async function loadValidation() {
  try {
    const response = await fetch("data/existing-scp.json?v=1");
    validationData = await response.json();
  } catch {
    statusBox.textContent = "Using fallback SCP validation.";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = updateValidation();
  if (result.state === "blocked") return;
  renderDocument();
});

Object.values(fields).forEach((field) => {
  field.addEventListener("input", () => {
    updateValidation();
    renderDocument();
  });
});

download.addEventListener("click", (event) => {
  const result = updateValidation();
  if (result.state === "blocked") {
    event.preventDefault();
    return;
  }
  renderDocument();
  updateDownloadLink();
  if (!download.href || download.href.endsWith("#")) event.preventDefault();
});

loadValidation().then(() => {
  updateValidation();
  renderDocument();
});
