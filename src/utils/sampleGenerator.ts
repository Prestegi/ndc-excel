import { cropImageFromBox } from './cropUtils';
import type { PersonRecord } from '../types';

/**
 * Generates a realistic high-resolution NDC Agent Data Collection Form scan image
 * with three candidate sections:
 * - Section 1: Kofi Emmanuel Mensah with passport photo
 * - Section 2: Amina Fatima Haruna with BLANK passport photo box
 * - Section 3: Kwame David Osei with passport photo & unclear card no handwriting
 */
export async function generateSampleFormImage(): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background - realistic scanned paper texture/white
  ctx.fillStyle = '#FAFAFA';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle paper border
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Header banner: NDC Colors (Green, White, Red, Black)
  ctx.fillStyle = '#0B3C5D';
  ctx.fillRect(40, 30, canvas.width - 80, 50);

  // NDC Header text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NATIONAL DEMOCRATIC CONGRESS (NDC)', canvas.width / 2, 62);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('2024 GENERAL ELECTIONS - AGENT DATA COLLECTION FORM', canvas.width / 2, 105);

  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#4B5563';
  ctx.fillText('REGION: GREATER ACCRA     |     CONSTITUENCY / LGA: AYAWASO CENTRAL', canvas.width / 2, 128);

  ctx.strokeStyle = '#9CA3AF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(40, 140);
  ctx.lineTo(canvas.width - 40, 140);
  ctx.stroke();

  // Helper to draw a stylized portrait avatar on a subcanvas
  const createAvatar = (color: string, initials: string, female = false) => {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 160;
    pCanvas.height = 200;
    const pCtx = pCanvas.getContext('2d')!;

    // Photo background
    pCtx.fillStyle = '#E2E8F0';
    pCtx.fillRect(0, 0, 160, 200);

    // Torso
    pCtx.fillStyle = color;
    pCtx.beginPath();
    pCtx.ellipse(80, 220, 75, 90, 0, 0, Math.PI * 2);
    pCtx.fill();

    // Head
    pCtx.fillStyle = female ? '#8D5524' : '#6F4E37';
    pCtx.beginPath();
    pCtx.arc(80, 85, 45, 0, Math.PI * 2);
    pCtx.fill();

    // Hair
    pCtx.fillStyle = '#1A202C';
    pCtx.beginPath();
    if (female) {
      pCtx.arc(80, 75, 48, Math.PI, Math.PI * 2);
    } else {
      pCtx.arc(80, 65, 45, Math.PI * 0.9, Math.PI * 2.1);
    }
    pCtx.fill();

    // Badge label
    pCtx.fillStyle = 'rgba(0,0,0,0.6)';
    pCtx.fillRect(10, 165, 140, 26);
    pCtx.fillStyle = '#FFFFFF';
    pCtx.font = 'bold 12px sans-serif';
    pCtx.textAlign = 'center';
    pCtx.fillText(initials, 80, 183);

    return pCanvas;
  };

  const avatar1 = createAvatar('#1E40AF', 'AGENT #1');
  const avatar3 = createAvatar('#065F46', 'AGENT #3');

  // Render 3 sections
  const sectionsData = [
    {
      title: 'SECTION 1: POLLING STATION AGENT',
      name: 'Kofi Emmanuel Mensah',
      cardNo: '020491823',
      ward: 'Ayawaso Central 04',
      pu: 'PU-01029 Kotobabi Basic School',
      phone: '0244192834',
      voterId: '9182736450',
      isCollation: true,
      hasPhoto: true,
      avatar: avatar1,
      yStart: 155,
      height: 440,
    },
    {
      title: 'SECTION 2: POLLING AGENT',
      name: 'Amina Fatima Haruna',
      cardNo: '010398452',
      ward: 'Ayawaso Central 04',
      pu: 'PU-01030 Islamic Center A',
      phone: '0501827493',
      voterId: '8291047261',
      isCollation: false,
      hasPhoto: false, // Blank photo!
      avatar: null,
      yStart: 620,
      height: 440,
    },
    {
      title: 'SECTION 3: CONSTITUENCY COLLATION AGENT',
      name: 'Kwame David Osei',
      cardNo: '030582914',
      ward: 'Ayawaso Central 02',
      pu: 'PU-01015 Community Centre',
      phone: '0277819204',
      voterId: '7392018456',
      isCollation: true,
      hasPhoto: true,
      avatar: avatar3,
      yStart: 1085,
      height: 450,
    },
  ];

  sectionsData.forEach((sec, idx) => {
    // Section box
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(40, sec.yStart, canvas.width - 80, sec.height);

    // Section header tab
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(41, sec.yStart + 1, canvas.width - 82, 32);
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(sec.title, 55, sec.yStart + 22);

    // Form fields table
    const drawField = (label: string, value: string, x: number, y: number, w: number, handwriting = true) => {
      ctx.fillStyle = '#6B7280';
      ctx.font = '11px sans-serif';
      ctx.fillText(label.toUpperCase(), x, y);

      ctx.strokeStyle = '#D1D5DB';
      ctx.strokeRect(x, y + 4, w, 32);

      ctx.fillStyle = '#111827';
      // Use cursive/italic style to simulate realistic handwriting
      ctx.font = handwriting ? 'italic 16px "Comic Sans MS", "Segoe Print", cursive, sans-serif' : '15px sans-serif';
      ctx.fillText(value, x + 8, y + 26);
    };

    const leftW = 420;
    const rightW = 420;
    const col1 = 60;
    const col2 = 500;

    // Row 1
    drawField('Full Name (as written)', sec.name, col1, sec.yStart + 45, leftW);
    drawField('Membership Card Number', sec.cardNo, col2, sec.yStart + 45, rightW);

    // Row 2
    drawField('Ward Name / Code', sec.ward, col1, sec.yStart + 120, leftW);
    drawField('Polling Unit Code & Name', sec.pu, col2, sec.yStart + 120, rightW);

    // Row 3
    drawField('Phone Number (Active)', sec.phone, col1, sec.yStart + 195, leftW);
    drawField("Voter's Card Number (Voter ID)", sec.voterId, col2, sec.yStart + 195, rightW);

    // Row 4: Checkboxes
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.fillText('Agent Category / Collation Designation:', col1, sec.yStart + 280);

    // Checkbox 1
    ctx.strokeRect(col1, sec.yStart + 295, 18, 18);
    if (sec.isCollation) {
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('✓', col1 + 2, sec.yStart + 310);
    }
    ctx.fillStyle = '#1F2937';
    ctx.font = '13px sans-serif';
    ctx.fillText('Collation Agent', col1 + 28, sec.yStart + 309);

    // Checkbox 2
    ctx.strokeRect(col1 + 180, sec.yStart + 295, 18, 18);
    if (!sec.isCollation) {
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('✓', col1 + 182, sec.yStart + 310);
    }
    ctx.fillStyle = '#1F2937';
    ctx.fillText('Polling Station Agent', col1 + 208, sec.yStart + 309);

    // Row 5: Signature line
    ctx.fillStyle = '#6B7280';
    ctx.font = '11px sans-serif';
    ctx.fillText("AGENT'S SIGNATURE & DATE:", col1, sec.yStart + 355);
    ctx.strokeStyle = '#4B5563';
    ctx.beginPath();
    ctx.moveTo(col1, sec.yStart + 395);
    ctx.lineTo(col1 + 350, sec.yStart + 395);
    ctx.stroke();

    ctx.fillStyle = '#1E3A8A';
    ctx.font = 'italic 18px cursive';
    ctx.fillText(sec.name.split(' ')[0] + ' M.', col1 + 30, sec.yStart + 390);

    // Passport Photo Box (Right side of section)
    const photoX = 960;
    const photoY = sec.yStart + 45;
    const photoW = 175;
    const photoH = 220;

    ctx.strokeStyle = '#4B5563';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    if (sec.hasPhoto && sec.avatar) {
      ctx.drawImage(sec.avatar, photoX, photoY, photoW, photoH);
      // Passport label below
      ctx.fillStyle = '#065F46';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[PASSPORT PHOTO AFFIXED]', photoX + photoW / 2, photoY + photoH + 20);
    } else {
      // Empty passport photo box
      ctx.fillStyle = '#F3F4F6';
      ctx.fillRect(photoX + 1, photoY + 1, photoW - 2, photoH - 2);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = 'italic 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AFFIX PASSPORT', photoX + photoW / 2, photoY + photoH / 2 - 10);
      ctx.fillText('PHOTOGRAPH HERE', photoX + photoW / 2, photoY + photoH / 2 + 10);

      ctx.fillStyle = '#DC2626';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('[BOX IS BLANK - NO PHOTO]', photoX + photoW / 2, photoY + photoH + 20);
    }
  });

  return canvas.toDataURL('image/jpeg', 0.95);
}
