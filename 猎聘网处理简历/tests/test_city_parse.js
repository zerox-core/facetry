// 验证期望城市解析：从"期望城市"字段提取，而非正文第一个城市
const fs = require('fs');
const src = fs.readFileSync('app/core/resume_parser.py', 'utf8');
const m = src.match(/LIEPIN_DETAIL_JS = r"""([\s\S]*?)"""/);
let js = m[1];

function run(label, full) {
  // 去掉 IIFE 外层，使内部变量可在 new Function 作用域内访问
  const body = js.replace(/^\s*\(function\s*\(\)\s*\{/, '').replace(/\}\s*\)\s*\(\s*\)\s*;?\s*$/, '');
  const code =
    'var full = ' + JSON.stringify(full) + ';\n' +
    'var document = { body: { innerText: full }, title: "", querySelector: function(){ return null; }, querySelectorAll: function(){ return []; } };\n' +
    'var location = { href: "" };\n' +
    body +
    '\nreturn { expectedCity: expectedCity, currentPosition: currentPosition, currentCompany: currentCompany };';
  try {
    const r = new Function(code)();
    console.log(`\n=== ${label} ===`);
    console.log('  expectedCity =>', JSON.stringify(r.expectedCity));
  } catch (e) { console.log(label, 'ERROR', e.message); }
}

const tan = `企业招聘套餐咨询
谭女士（TA设置了姓名保护）
在线
更新简历时间：2026.04.29
佛山
工作5年
29 岁
在职，急寻新工作
9k×12薪
湖北理工学院 · 药学 · 本科 · 统招
期望城市：武汉、宜昌
期望薪资：9-12K
上海药明津石医药科技有限公司 · 临床协调员
懂合规、善沟通、精质控、稳执行。`;

const noField = `张先生 男 北京 期望薪资 20K 5年经验 CRA`;
const nation = `李女士\n期望城市：全国\n广州某CRO 临床监查员`;

run('谭女士(期望武汉、宜昌)', tan);
run('无字段(回退第一个城市)', noField);
run('期望全国', nation);
