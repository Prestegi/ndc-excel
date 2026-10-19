import ExcelJS from 'exceljs';
import type { PersonRecord, ReviewLogItem } from '../types';

export interface ExcelExportOptions {
  records: PersonRecord[];
  reviewLogs?: ReviewLogItem[];
  logoBase64?: string;
  batchName?: string;
  onlyApproved?: boolean;
}

export async function generateNdcAgentExcel(options: ExcelExportOptions): Promise<Blob> {
  const { records, reviewLogs = [], logoBase64, batchName = 'NDC_Agent_Register' } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NDC Scanner';
  workbook.created = new Date();

  // ==========================================
  // SHEET 1: Main Register
  // ==========================================
  const mainSheet = workbook.addWorksheet('NDC Agents Register', {
    views: [{ state: 'frozen', ySplit: 3, xSplit: 0 }],
  });

  // Title Row (Row 1)
  mainSheet.mergeCells('A1:H1');
  const titleCell = mainSheet.getCell('A1');
  titleCell.value = 'NATIONAL DEMOCRATIC CONGRESS - ACCREDITED AGENTS REGISTER';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B3C5D' }, // Professional NDC dark navy/blue
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  mainSheet.getRow(1).height = 36;

  // Header Row (Row 3)
  const headers = [
    'S/N',
    'Name',
    'Membership Card No.',
    'Ward',
    'Polling Unit',
    'Phone No.',
    'Voter’s Card No.',
    'Passport Photograph',
  ];

  const headerRow = mainSheet.getRow(3);
  headerRow.values = headers;
  headerRow.height = 28;

  // Header styling: blue background, white bold text, borders
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D5F8A' }, // Rich blue header
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0B3C5D' } },
      left: { style: 'thin', color: { argb: 'FFB0BEC5' } },
      bottom: { style: 'medium', color: { argb: 'FF0B3C5D' } },
      right: { style: 'thin', color: { argb: 'FFB0BEC5' } },
    };
  });

  // Set column widths and text formatting to preserve leading zeros
  mainSheet.columns = [
    { key: 'sn', width: 8 },
    { key: 'name', width: 28 },
    { key: 'membershipNo', width: 24, style: { numFmt: '@' } },
    { key: 'ward', width: 24 },
    { key: 'pollingUnit', width: 32, style: { numFmt: '@' } },
    { key: 'phoneNo', width: 20, style: { numFmt: '@' } },
    { key: 'votersCardNo', width: 22, style: { numFmt: '@' } },
    { key: 'passport', width: 18 },
  ];

  // Optional logo insertion in Row 2 or A1
  if (logoBase64) {
    try {
      const cleanLogo = logoBase64.replace(/^data:[^;]+;base64,/, '');
      const logoId = workbook.addImage({
        base64: cleanLogo,
        extension: 'png',
      });
      mainSheet.addImage(logoId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 34, height: 34 },
      });
    } catch (e) {
      console.warn('Failed to insert logo into Excel:', e);
    }
  }

  // Populate data rows
  records.forEach((record, idx) => {
    const rowNumber = idx + 4; // Data begins at row 4
    const row = mainSheet.getRow(rowNumber);
    row.height = record.hasPassportPhoto && record.passportPhotoUrl ? 75 : 30;

    // Preserve identifiers strictly as strings with leading zeros
    row.getCell(1).value = idx + 1; // Consecutive S/N
    row.getCell(2).value = record.name || '';
    row.getCell(3).value = String(record.membershipNo || '');
    row.getCell(4).value = record.ward || '';
    row.getCell(5).value = String(record.pollingUnit || '');
    row.getCell(6).value = String(record.phoneNo || '');
    row.getCell(7).value = String(record.votersCardNo || '');
    row.getCell(8).value = record.hasPassportPhoto ? '' : '[No Photo]';

    // Cell alignments and borders
    const isEven = idx % 2 === 0;
    const zebraColor = isEven ? 'FFFFFFFF' : 'FFF7FAFC';

    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: zebraColor },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: c === 1 ? 'center' : c === 8 ? 'center' : 'left',
        wrapText: true,
      };
      cell.font = { name: 'Calibri', size: 10 };
    }

    // Embed passport image if present
    if (record.hasPassportPhoto && record.passportPhotoUrl) {
      try {
        const cleanBase64 = record.passportPhotoUrl.replace(/^data:[^;]+;base64,/, '');
        const imageId = workbook.addImage({
          base64: cleanBase64,
          extension: 'jpeg',
        });

        mainSheet.addImage(imageId, {
          tl: { col: 7.15, row: rowNumber - 1 + 0.1 },
          ext: { width: 68, height: 86 },
          editAs: 'oneCell',
        });
      } catch (err) {
        console.warn('Could not embed passport image for record:', record.name, err);
        row.getCell(8).value = '[Image Error]';
      }
    }
  });

  // Enable auto filters on data range
  mainSheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: records.length + 3, column: 8 },
  };

  // ==========================================
  // SHEET 2: Additional Details
  // ==========================================
  const detailsSheet = workbook.addWorksheet('Additional Details', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }],
  });

  const detailHeaders = [
    'S/N',
    'Name',
    'State / Region',
    'LGA / Constituency',
    'Collation Agent Role',
    'Collation Agent Ticked',
    'Review Status',
    'System Flags',
    'Source File',
    'Page No.',
    'Section No.',
  ];

  const detailHeaderRow = detailsSheet.getRow(1);
  detailHeaderRow.values = detailHeaders;
  detailHeaderRow.height = 26;
  detailHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2A7B9B' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  detailsSheet.columns = [
    { key: 'sn', width: 8 },
    { key: 'name', width: 28 },
    { key: 'state', width: 20 },
    { key: 'lga', width: 22 },
    { key: 'role', width: 26 },
    { key: 'isCollation', width: 20 },
    { key: 'status', width: 16 },
    { key: 'flags', width: 28 },
    { key: 'file', width: 25 },
    { key: 'page', width: 12 },
    { key: 'section', width: 14 },
  ];

  records.forEach((record, idx) => {
    const row = detailsSheet.getRow(idx + 2);
    row.values = [
      idx + 1,
      record.name,
      record.state || 'N/A',
      record.lga || 'N/A',
      record.collationAgentRole || 'N/A',
      record.isCollationAgent ? 'YES' : 'NO',
      record.reviewStatus.toUpperCase(),
      (record.flags || []).join(', ') || 'None',
      record.sourceFileName || 'Scan',
      record.pageNumber || 1,
      record.sectionIndex != null ? record.sectionIndex + 1 : '1',
    ];
    row.height = 20;
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  // ==========================================
  // SHEET 3: Review & Audit Log
  // ==========================================
  const logSheet = workbook.addWorksheet('Review Log', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }],
  });

  const logHeaders = [
    'Timestamp',
    'Record S/N',
    'Candidate Name',
    'Action / Edit',
    'Details / Changed Value',
    'Reviewer ID',
  ];

  const logHeaderRow = logSheet.getRow(1);
  logHeaderRow.values = logHeaders;
  logHeaderRow.height = 26;
  logHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B5998' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  logSheet.columns = [
    { key: 'time', width: 22 },
    { key: 'sn', width: 14 },
    { key: 'name', width: 26 },
    { key: 'action', width: 22 },
    { key: 'details', width: 45 },
    { key: 'reviewer', width: 24 },
  ];

  // Populate review log from records' correctionHistory and passed logs
  let logRowIdx = 2;
  records.forEach((rec, snIdx) => {
    (rec.correctionHistory || []).forEach((hist) => {
      const row = logSheet.getRow(logRowIdx++);
      row.values = [
        hist.changedAt,
        snIdx + 1,
        rec.name,
        `Field Modified: ${hist.field}`,
        `Old: "${hist.oldValue}" -> New: "${hist.newValue}"`,
        hist.changedBy || 'Reviewer',
      ];
      row.height = 20;
    });

    if (rec.reviewStatus === 'approved') {
      const row = logSheet.getRow(logRowIdx++);
      row.values = [
        rec.reviewedAt || rec.updatedAt,
        snIdx + 1,
        rec.name,
        'Record Approved',
        `Validated by reviewer: ${rec.reviewedBy || 'User'}`,
        rec.reviewedBy || 'Reviewer',
      ];
      row.height = 20;
    }
  });

  // Write workbook to buffer and return blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
