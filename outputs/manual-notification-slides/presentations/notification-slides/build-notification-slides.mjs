const { FileBlob, PresentationFile } = await import(
  "file:///C:/Users/Ivan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs"
);
import fs from "node:fs/promises";

const source = "C:/programming/coursework/electronics-repair-system/presentation/Smart-Life-coursework-presentation.pptx";
const output = "C:/programming/coursework/electronics-repair-system/presentation/Smart-Life-coursework-presentation-with-notifications.pptx";
const previewDir = "C:/programming/coursework/outputs/manual-notification-slides/presentations/notification-slides/preview";
const smsImage = "C:/programming/coursework/outputs/manual-notification-slides/presentations/notification-slides/assets/sms-page.png";
const emailImage = "C:/programming/coursework/outputs/manual-notification-slides/presentations/notification-slides/assets/email-page.png";
const smsImageData = `data:image/png;base64,${(await fs.readFile(smsImage)).toString("base64")}`;
const emailImageData = `data:image/png;base64,${(await fs.readFile(emailImage)).toString("base64")}`;

const C = {
  ink: "#10233F",
  muted: "#63768C",
  teal: "#0D9488",
  pale: "#EEF8F6",
  mint: "#DDF5F0",
  line: "#C8DDDD",
  white: "#FFFFFF",
};

function addShape(slide, geometry, frame, fill = null, line = null, radius = null) {
  const shape = slide.shapes.add({
    geometry,
    position: frame,
    ...(fill ? { fill: { color: fill } } : {}),
    ...(line ? { line: { color: line, width: 1 } } : {}),
  });
  if (radius !== null) shape.borderRadius = radius;
  return shape;
}

function addText(slide, text, frame, style = {}) {
  const shape = addShape(slide, "rect", frame, style.fill ?? C.white, style.line ?? style.fill ?? C.white);
  shape.text.set(text);
  shape.text.typeface = "Aptos";
  shape.text.fontSize = style.fontSize ?? 18;
  shape.text.color = style.color ?? C.ink;
  shape.text.bold = style.bold ?? false;
  shape.text.alignment = style.alignment ?? "left";
  shape.text.verticalAlignment = style.verticalAlignment ?? "middle";
  shape.text.insets = style.insets ?? { left: 0, right: 0, top: 0, bottom: 0 };
  return shape;
}

function addHeader(slide, kicker, title, subtitle, number, options = {}) {
  const titleWidth = options.titleWidth ?? 690;
  const subtitleWidth = options.subtitleWidth ?? 650;
  slide.background.fill = { color: C.pale };
  addShape(slide, "rect", { left: 0, top: 0, width: 16, height: 720 }, C.teal, C.teal);
  addText(slide, kicker.toUpperCase(), { left: 64, top: 45, width: 520, height: 24 }, {
    fontSize: 12, bold: true, color: C.teal, fill: C.pale, line: C.pale,
  });
  addText(slide, title, { left: 64, top: 77, width: titleWidth, height: 72 }, {
    fontSize: 30, bold: true, color: C.ink, fill: C.pale, line: C.pale,
  });
  addText(slide, subtitle, { left: 64, top: 150, width: subtitleWidth, height: 42 }, {
    fontSize: 15, color: C.muted, fill: C.pale, line: C.pale,
  });
  addText(slide, String(number).padStart(2, "0"), { left: 1180, top: 48, width: 50, height: 30 }, {
    fontSize: 13, bold: true, color: C.teal, fill: C.pale, line: C.pale, alignment: "right",
  });
}

function addBullet(slide, y, number, title, body) {
  addShape(slide, "ellipse", { left: 70, top: y, width: 38, height: 38 }, C.teal, C.teal);
  addText(slide, String(number), { left: 70, top: y, width: 38, height: 38 }, {
    fontSize: 15, bold: true, color: C.white, fill: C.teal, line: C.teal, alignment: "center",
  });
  addText(slide, title, { left: 126, top: y - 2, width: 430, height: 26 }, {
    fontSize: 17, bold: true, color: C.ink, fill: C.pale, line: C.pale,
  });
  addText(slide, body, { left: 126, top: y + 26, width: 430, height: 46 }, {
    fontSize: 13, color: C.muted, fill: C.pale, line: C.pale,
  });
}

function addScreenshotFrame(slide, imageData, frame, caption) {
  addShape(slide, "roundRect", { left: frame.left - 10, top: frame.top - 10, width: frame.width + 20, height: frame.height + 20 }, C.white, C.line, 14);
  const image = slide.images.add({ dataUrl: imageData, position: frame, fit: "contain" });
  image.alt = caption;
  addText(slide, caption, { left: frame.left, top: frame.top + frame.height + 14, width: frame.width, height: 22 }, {
    fontSize: 11, color: C.muted, fill: C.pale, line: C.pale, alignment: "center",
  });
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(source));

{
  const slide = presentation.slides.add();
  slide.setViewportSize(1280, 720);
  addHeader(
    slide,
    "Автоматичні сповіщення",
    "SMS повідомляє клієнта у ключові моменти",
    "Коротке повідомлення надсилається автоматично, коли замовлення прийнято або ремонт завершено.",
    10,
  );
  addBullet(slide, 235, 1, "Тільки важливі статуси", "SMS не дублює кожну зміну: клієнт отримує повідомлення при прийнятті та виконанні.");
  addBullet(slide, 335, 2, "Twilio та нормалізація номера", "Сервер формує текст, приводить номер до міжнародного формату та викликає Twilio API.");
  addBullet(slide, 435, 3, "Сума до оплати в повідомленні", "Після завершення ремонту клієнт одразу бачить фінальну вартість і готовність пристрою.");
  addShape(slide, "roundRect", { left: 64, top: 565, width: 510, height: 74 }, C.mint, C.line, 12);
  addText(slide, "Результат: менше уточнювальних дзвінків і прозорий статус ремонту.", { left: 86, top: 577, width: 465, height: 48 }, {
    fontSize: 15, bold: true, color: C.ink, fill: C.mint, line: C.mint,
  });
  addScreenshotFrame(slide, smsImageData, { left: 744, top: 88, width: 400, height: 540 }, "Демонстраційний приклад SMS без реальних контактів");
  slide.speakerNotes.text = "SMS надсилається лише на двох етапах: після прийняття замовлення та після завершення ремонту. У завершальному повідомленні клієнт бачить суму до оплати.";
}

{
  const slide = presentation.slides.add();
  slide.setViewportSize(1280, 720);
  addHeader(
    slide,
    "Автоматичні сповіщення",
    "Email передає повну інформацію про готове замовлення",
    "Структурований лист доповнює SMS: показує статус, пристрій, номер замовлення та фінальну суму.",
    11,
    { titleWidth: 555, subtitleWidth: 555 },
  );
  addBullet(slide, 235, 1, "HTML-шаблон у стилі системи", "Лист використовує ті самі кольори, статуси та візуальну ієрархію, що й робочий інтерфейс.");
  addBullet(slide, 335, 2, "Nodemailer і Gmail", "Сервер створює персоналізований лист та надсилає його через налаштований поштовий транспорт.");
  addBullet(slide, 435, 3, "Усі деталі в одному місці", "Клієнт бачить номер замовлення, пристрій, поточний статус, наступний крок і суму.");
  addShape(slide, "roundRect", { left: 64, top: 565, width: 510, height: 74 }, C.mint, C.line, 12);
  addText(slide, "Результат: клієнт отримує зрозуміле підтвердження, яке можна зберегти.", { left: 86, top: 577, width: 465, height: 48 }, {
    fontSize: 15, bold: true, color: C.ink, fill: C.mint, line: C.mint,
  });
  addScreenshotFrame(slide, emailImageData, { left: 650, top: 118, width: 555, height: 470 }, "Демонстраційний приклад листа про завершення ремонту");
  slide.speakerNotes.text = "Email містить детальнішу інформацію, ніж SMS. HTML-шаблон формує лист у стилі системи та показує клієнту фінальну суму до оплати.";
}

const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(output);

for (let i = presentation.slides.count - 2; i < presentation.slides.count; i += 1) {
  const preview = await presentation.slides.getItem(i).export({ format: "png", scale: 1 });
  await fs.writeFile(`${previewDir}/slide-${String(i + 1).padStart(2, "0")}.png`, Buffer.from(await preview.arrayBuffer()));
}

console.log(JSON.stringify({ output, slides: presentation.slides.count }));
