const fs = require('fs');
const src = fs.readFileSync('app/core/resume_parser.py', 'utf8');
const m = src.match(/LIEPIN_DETAIL_JS = r"""([\s\S]*?)"""/);
const js = m[1];

function run(name, text, title) {
  const docCode = 'var document = { body:{innerText:' + JSON.stringify(text)
    + '}, title:' + JSON.stringify(title || '')
    + ', querySelector:function(){return null;}, querySelectorAll:function(){return [];} };'
    + ' var location = {href:""};';
  const code = docCode + 'var __r = ' + js + '; return __r;';
  try {
    const r = new Function(code)();
    console.log('\n=== ' + name + ' ===');
    console.log('current_position:', JSON.stringify(r.current_position), '| current_company:', JSON.stringify(r.current_company));
    console.log('work_exps:', JSON.stringify(r.work_exps));
  } catch (e) { console.log(name, 'ERROR', e.message); }
}

run('同行分隔',
  '工作经历\n2020.07 - 至今\n康龙化成 | 高级临床监查员\n负责III期临床监查\n2018.07 - 2020.06\n泰格医药 | 临床监查员');

run('换行分列',
  '工作经历\n2021.03 - 至今\n某CRO公司\nSSU主管\n中心筛选、伦理递交\n2019.07 - 2021.02\n某医院\nCRC');

run('无标题+自评段落',
  '个人优势\n本人于2025年6月主动离职并深入学习以下内容：\n1、英语：已从哑巴英语学习者进化至可以用英语进行商业交流；可以进行英语写作，作品获得AI工具的认可。\n2、承认自身不足很重要，持续学习也很重要。\n教育经历\n2014.09 - 2018.06\nXX大学 药学');

run('混合结构',
  '自我评价\n本人责任心强，抗压能力好。\n工作经历\n2019.09 - 至今\n丽珠集团 | 临床监查员\n负责肿瘤项目监查\n教育经历\n2015.09 - 2019.06\nYY大学 临床医学');

run('目前任职于兜底',
  '目前任职于 智飞生物 ，担任 医学经理，负责疫苗医学策略。\n工作经历\n空缺');
