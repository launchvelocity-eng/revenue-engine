import { Transform } from 'stream';

export class MagicByteInspectionTransform extends Transform {
    constructor(options = {}) {
        super(options);
        this.headerChecked = false;
        this.headerBuffer = Buffer.alloc(0);
        this.MAX_HEADER_BYTES = 8; // Enough to check MZ, ELF, ZIP/Java signatures
    }

    _transform(chunk, encoding, callback) {
        if (this.headerChecked) {
            // Once header is verified, pass all subsequent chunks straight through downstream
            return callback(null, chunk);
        }

        // Accumulate initial bytes until we reach our inspection window
        this.headerBuffer = Buffer.concat([this.headerBuffer, chunk]);

        if (this.headerBuffer.length >= this.MAX_HEADER_BYTES || chunk.length === 0) {
            this.headerChecked = true;
            
            const hexHeader = this.headerBuffer.subarray(0, 4).toString('hex').toUpperCase();

            // 1. Check for Windows PE Executables / DLLs / Screensavers (MZ Header: 4D5A)
            if (hexHeader.startsWith('4D5A')) {
                return callback(new Error('THREAT_DETECTED_PE_EXECUTABLE'));
            }

            // 2. Check for Linux ELF Binaries / Scripts (ELF Header: 7F454C46)
            if (hexHeader.startsWith('7F454C46')) {
                return callback(new Error('THREAT_DETECTED_ELF_BINARY'));
            }

            // 3. Check for Compiled Java Archives / Executable ZIP wrappers (504B0304)
            if (hexHeader.startsWith('504B0304')) {
                return callback(new Error('THREAT_DETECTED_ARCHIVE_PAYLOAD'));
            }

            // Flush the accumulated header buffer downstream, then let the rest flow
            this.push(this.headerBuffer);
            this.headerBuffer = null; // Release memory reference
        }

        callback();
    }
}
