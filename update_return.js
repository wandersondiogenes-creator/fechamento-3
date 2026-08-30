const fs = require('fs');
const file = 'components/FechamentoView.tsx';
let code = fs.readFileSync(file, 'utf8');

const getBrandLogoStr = `
const getBrandLogo = (empName) => {
  const lower = empName.toLowerCase();
  if (lower.includes('byd')) return 'https://upload.wikimedia.org/wikipedia/commons/f/f3/BYD_Auto_2022_logo.svg';
  if (lower.includes('jeep') || lower.includes('cjdr')) return 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Jeep_logo.svg';
  if (lower.includes('fiat')) return 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Fiat_Automobiles_logo.svg';
  if (lower.includes('ford')) return 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Ford_Motor_Company_Logo.svg';
  if (lower.includes('honda')) return 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Honda_Logo.svg';
  if (lower.includes('hyundai')) return 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg';
  if (lower.includes('geely')) return 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Geely_2023_logo.svg';
  if (lower.includes('nissan')) return 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Nissan_logo.png';
  if (lower.includes('toyota')) return 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Toyota_carlogo.svg';
  if (lower.includes('renault')) return 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Renault_2021_Text.svg';
  if (lower.includes('peugeot')) return 'https://upload.wikimedia.org/wikipedia/en/9/91/Peugeot_2021_Logo.svg';
  return null;
};
`;

const startIndex = code.indexOf('  const selectedEmpData = selectedCompanyPanel');
if (startIndex !== -1) {
  let beforeReturn = code.substring(0, startIndex);
  if (!beforeReturn.includes('getBrandLogo')) {
     beforeReturn = beforeReturn + getBrandLogoStr + '\n';
  }
  
  // We'll output the JS script that replaces the return block.
  console.log('Success finding start index');
} else {
  console.log('Could not find start index');
}
