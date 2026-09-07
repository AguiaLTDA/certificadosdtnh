import QRCode from 'qrcode';

/**
 * Gera o QR Code que leva a pagina publica de validacao do certificado.
 * Nivel de correcao "M": aguenta impressao e leve sujeira sem falhar a leitura.
 */
export async function gerarQrCode(url, { escala = 8, cor = '#000000', fundo = '#FFFFFF' } = {}) {
  return QRCode.toBuffer(url, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: escala,
    color: { dark: cor, light: fundo },
  });
}

export async function gerarQrCodeDataUrl(url) {
  return QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, scale: 6 });
}
