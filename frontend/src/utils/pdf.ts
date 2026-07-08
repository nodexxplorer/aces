import { jsPDF } from 'jspdf';

interface TranscriptData {
  studentName: string;
  matricNumber: string;
  department: string;
  semester: string;
  session: string;
  courses: { code: string; title: string; credit: number; grade: string }[];
  cgpa?: string;
}

export const generateTranscriptPDF = async (data: TranscriptData): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text('ACES ZONE', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(14);
  doc.text('OFFICIAL TRANSCRIPT', pageWidth / 2, 30, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`Student: ${data.studentName}`, 14, 45);
  doc.text(`Matric No: ${data.matricNumber}`, 14, 52);
  doc.text(`Department: ${data.department}`, 14, 59);
  doc.text(`Session: ${data.session}  |  Semester: ${data.semester}`, 14, 66);

  doc.setFontSize(9);
  const headers = ['Code', 'Course Title', 'Credit', 'Grade'];
  const startY = 78;
  const colWidths = [28, 100, 20, 20];
  const colStarts = [14, 14 + colWidths[0], 14 + colWidths[0] + colWidths[1], 14 + colWidths[0] + colWidths[1] + colWidths[2]];

  doc.setFont('Helvetica', 'bold');
  headers.forEach((h, i) => doc.text(h, colStarts[i], startY));
  doc.line(14, startY + 2, 14 + colWidths.reduce((a, b) => a + b, 0), startY + 2);

  doc.setFont('Helvetica', 'normal');
  let y = startY + 10;
  data.courses.forEach((c) => {
    doc.text(c.code, colStarts[0], y);
    doc.text(c.title.substring(0, 40), colStarts[1], y);
    doc.text(String(c.credit), colStarts[2], y);
    doc.text(c.grade, colStarts[3], y);
    y += 7;
  });

  if (data.cgpa) {
    y += 6;
    doc.setFont('Helvetica', 'bold');
    doc.text(`CGPA: ${data.cgpa}`, 14, y);
  }

  const blob = doc.output('blob');
  return blob;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
