// 角色配置：id -> 基本信息。图片命名 assets/characters/{prefix}_{key}.webp
// key: full / avatar / serious / smile / worry
var CHARS = {
  zhou:     { name: '周政委', prefix: '01_zhou',     role: '红军指挥员' },
  hongwa:   { name: '红娃',   prefix: '02_hongwa',   role: '司号员' },
  xiaozhu:  { name: '小竹',   prefix: '03_xiaozhu',  role: '卫生员' },
  zhaomeng: { name: '赵猛',   prefix: '04_zhaomeng', role: '侦察连长' },
  jiangshu: { name: '江叔',   prefix: '05_jiangshu', role: '老船工' },
  yedan:    { name: '小叶丹', prefix: '06_yedan',    role: '彝族首领' },
  zhaxi:    { name: '扎西',   prefix: '07_zhaxi',    role: '藏族向导' },
  wang:     { name: '王金彪', prefix: '08_wang',     role: '敌军团长', enemy: true },
  qian:     { name: '钱参谋', prefix: '09_qian',     role: '敌军参谋', enemy: true }
};

function charImg(chId, key) {
  var c = CHARS[chId];
  if (!c) c = CHARS.zhou;
  return 'assets/characters/' + c.prefix + '_' + (key || 'full') + '.webp';
}
