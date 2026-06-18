from PyPDF2 import PdfReader, PdfWriter

pdf_path = 'Drumadon_Essentials_Book.pdf'
reader = PdfReader(pdf_path)
writer = PdfWriter()

# Add all pages except 23 and 24 (indices 22 and 23)
for i in range(len(reader.pages)):
    if i != 22 and i != 23:
        writer.add_page(reader.pages[i])

# Write the modified PDF
with open(pdf_path, 'wb') as f:
    writer.write(f)

print(f'Successfully removed pages 23-24. Total pages: {len(writer.pages)}')
