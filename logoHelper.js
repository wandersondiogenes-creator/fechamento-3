const fs = require('fs');
const file = 'components/FechamentoView.tsx';
let code = fs.readFileSync(file, 'utf8');

const logoFn = `
const getCompanyLogo = (empName: string) => {
  const n = empName.toLowerCase();
  if (n.includes('byd')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/BYD_Logo.svg/1024px-BYD_Logo.svg.png';
  if (n.includes('jeep')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Jeep_logo.svg/1024px-Jeep_logo.svg.png';
  if (n.includes('fiat')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Fiat_Automobiles_logo.svg/1024px-Fiat_Automobiles_logo.svg.png';
  if (n.includes('ford')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Ford_Motor_Company_Logo.svg/1024px-Ford_Motor_Company_Logo.svg.png';
  if (n.includes('honda')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Honda_Logo.svg/1024px-Honda_Logo.svg.png';
  if (n.includes('hyundai')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Hyundai_Motor_Company_logo.svg/1024px-Hyundai_Motor_Company_logo.svg.png';
  if (n.includes('geely')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Geely_Auto_logo.svg/1024px-Geely_Auto_logo.svg.png';
  if (n.includes('cjdr')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Jeep_logo.svg/1024px-Jeep_logo.svg.png';
  return null;
};
`;

if (!code.includes('getCompanyLogo')) {
  const importsIndex = code.lastIndexOf('import ');
  const endOfImports = code.indexOf('\n', importsIndex) + 1;
  code = code.substring(0, endOfImports) + logoFn + code.substring(endOfImports);
  fs.writeFileSync(file, code);
}
