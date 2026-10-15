/**
 * Creates the MeQ SUS questionnaire (thesis Appendix C) as a Google Form,
 * with its responses linked to a new Google Sheet.
 *
 * How to use:
 * 1. Open https://script.google.com and choose New project.
 * 2. Replace the editor contents with this file and click Run (createSusForm).
 * 3. Allow access when Google asks. The log shows the links to the form and the sheet.
 *
 * The statements must stay identical to Table C.1 in the thesis.
 */
function createSusForm() {
  const form = FormApp.create('แบบประเมินความใช้งานง่ายของระบบ MeQ (SUS)');
  form.setDescription(
    'แบบสอบถามนี้ใช้ประเมินระบบ MeQ สำหรับโครงงานปริญญานิพนธ์ ภาควิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยนเรศวร ' +
    'ใช้เวลาประมาณ 3 นาที\n\n' +
    'ก่อนตอบ โปรดใช้ MeQ บนโทรศัพท์ของท่านดังนี้\n' +
    '1. เข้าสู่ระบบด้วย LINE\n' +
    '2. สร้างทีมหรือรับคำเชิญเข้าทีม\n' +
    '3. ดูคิวของทุกสนามและลงคิว\n' +
    '4. เช็กอินเมื่อถึงคิวและยืนยันความพร้อม\n' +
    '5. ส่งคะแนนหลังจบเกม และดูสถิติของตนเอง\n' +
    '6. แจ้งซ่อมอุปกรณ์สนาม 1 รายการ'
  );
  form.setCollectEmail(false);
  form.setShowLinkToRespondAgain(false);
  form.setProgressBar(true);
  form.setConfirmationMessage('ขอบคุณที่ร่วมประเมินระบบ MeQ');

  // Section 1: consent. Declining ends the form.
  const consent = form.addMultipleChoiceItem()
    .setTitle('การยินยอมเข้าร่วมการประเมิน')
    .setHelpText(
      'ข้าพเจ้ายินยอมเข้าร่วมการประเมินระบบ MeQ ซึ่งเป็นส่วนหนึ่งของโครงงานปริญญานิพนธ์ ภาควิชาวิทยาการคอมพิวเตอร์ ' +
      'มหาวิทยาลัยนเรศวร แบบสอบถามนี้ไม่เก็บชื่อหรือข้อมูลที่ระบุตัวตน คำตอบจะใช้เพื่อการวิเคราะห์ในภาพรวมเท่านั้น ' +
      'ข้าพเจ้าสามารถหยุดหรือถอนตัวได้ทุกเมื่อโดยไม่มีผลใด ๆ ต่อการใช้สนาม'
    )
    .setRequired(true);

  // Section 2: the ten SUS statements.
  form.addPageBreakItem()
    .setTitle('แบบสอบถาม')
    .setHelpText('โปรดเลือกระดับความเห็นของท่านต่อข้อความแต่ละข้อ (1 = ไม่เห็นด้วยอย่างยิ่ง, 5 = เห็นด้วยอย่างยิ่ง)');

  consent.setChoices([
    consent.createChoice('ยินยอม', FormApp.PageNavigationType.CONTINUE),
    consent.createChoice('ไม่ยินยอม', FormApp.PageNavigationType.SUBMIT),
  ]);

  const statements = [
    'ฉันคิดว่าฉันอยากใช้ MeQ เป็นประจำ',
    'ฉันรู้สึกว่า MeQ ซับซ้อนเกินความจำเป็น',
    'ฉันคิดว่า MeQ ใช้งานง่าย',
    'ฉันคิดว่าต้องมีคนช่วยแนะนำ จึงจะใช้ MeQ ได้',
    'ฉันพบว่าฟังก์ชันต่าง ๆ ของ MeQ ทำงานเชื่อมโยงกันได้ดี',
    'ฉันคิดว่า MeQ มีส่วนที่ไม่สอดคล้องกันมากเกินไป',
    'ฉันคิดว่าคนส่วนใหญ่จะเรียนรู้วิธีใช้ MeQ ได้อย่างรวดเร็ว',
    'ฉันรู้สึกว่า MeQ ใช้งานยุ่งยาก',
    'ฉันรู้สึกมั่นใจขณะใช้ MeQ',
    'ฉันต้องเรียนรู้หลายอย่างก่อนจึงจะเริ่มใช้ MeQ ได้',
  ];
  statements.forEach(function (text, i) {
    form.addScaleItem()
      .setTitle((i + 1) + '. ' + text)
      .setBounds(1, 5)
      .setLabels('ไม่เห็นด้วยอย่างยิ่ง', 'เห็นด้วยอย่างยิ่ง')
      .setRequired(true);
  });

  form.addParagraphTextItem()
    .setTitle('ข้อเสนอแนะเพิ่มเติม (ไม่บังคับ)');

  // Section 3: two background questions, asked after the SUS so they cannot influence it.
  form.addPageBreakItem()
    .setTitle('ข้อมูลผู้ตอบ')
    .setHelpText('ใช้เพื่ออธิบายกลุ่มผู้ตอบในภาพรวมเท่านั้น');
  form.addMultipleChoiceItem()
    .setTitle('คุณมาเล่นที่สนามบาสมหาวิทยาลัยนเรศวรบ่อยแค่ไหน')
    .setChoiceValues(['สัปดาห์ละ 4 ครั้งขึ้นไป', 'สัปดาห์ละ 2–3 ครั้ง', 'สัปดาห์ละครั้งหรือน้อยกว่า', 'ครั้งแรก'])
    .setRequired(true);
  form.addMultipleChoiceItem()
    .setTitle('ในการทดลองครั้งนี้ คุณใช้ MeQ ในฐานะอะไร')
    .setChoiceValues(['หัวหน้าทีม หรือผู้ช่วยหัวหน้า', 'สมาชิกทีม'])
    .setRequired(true);

  const sheet = SpreadsheetApp.create('MeQ SUS responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('Form to share: ' + form.getPublishedUrl());
  Logger.log('Form editor:   ' + form.getEditUrl());
  Logger.log('Responses:     ' + sheet.getUrl());
}
