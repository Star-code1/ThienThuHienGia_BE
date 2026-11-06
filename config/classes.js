// Nguồn duy nhất cho danh sách Bát Đại Võ Phái (ID role Discord + từ khoá nickname)
const CLASS_ROLE_MAP = {
  '1566703589605249115': 'Huyền Cơ',
  '1479112953813795038': 'Long Ngâm',
  '1439916836895588493': 'Toái Mộng',
  '1439916573031796767': 'Thần Tương',
  '1439916668963782696': 'Huyết Hà',
  '1439916770528854046': 'Tố Vấn',
  '1439916801550061661': 'Thiết Y',
  '1439916837277008005': 'Cửu Linh'
};

const CLASS_KEYWORDS = [
  { name: 'Huyền Cơ', keys: ['huyền cơ', 'huyen co', 'huyenco', '[hc]', 'hc_'] },
  { name: 'Tố Vấn', keys: ['tố vấn', 'to van', 'tovan', '[tv]', 'tv_'] },
  { name: 'Huyết Hà', keys: ['huyết hà', 'huyet ha', 'huyetha', '[hh]', 'hh_'] },
  { name: 'Thần Tương', keys: ['thần ', 'than tuong', 'thantuong', '[tt]', 'tt_'] },
  { name: 'Toái Mộng', keys: ['toái mộng', 'toai mong', 'toaimong', '[tm]', 'tm_'] },
  { name: 'Thiết Y', keys: ['thiết y', 'thiet y', 'thiety', '[ty]', 'ty_'] },
  { name: 'Long Ngâm', keys: ['long ngâm', 'long ngam', 'longngam', '[ln]', 'ln_'] },
  { name: 'Cửu Linh', keys: ['cửu linh', 'cuu linh', 'cuulinh', '[cl]', 'cl_'] }
];

function getClassFromRoles(roleIds, nickname) {
  for (const rId of roleIds || []) {
    if (CLASS_ROLE_MAP[rId]) {
      return CLASS_ROLE_MAP[rId];
    }
  }
  // Fallback to nickname text parsing if no class role assigned
  if (!nickname) return 'Chưa rõ';
  const lower = nickname.toLowerCase();
  for (const item of CLASS_KEYWORDS) {
    if (item.keys.some((k) => lower.includes(k))) {
      return item.name;
    }
  }
  return 'Chưa rõ';
}

module.exports = { CLASS_ROLE_MAP, CLASS_KEYWORDS, getClassFromRoles };
