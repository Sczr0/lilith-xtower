#!/usr/bin/env node

/**
 * 内容管理CLI工具
 * 用于添加、编辑、删除公告和新曲速递
 */

const prompts = require('prompts');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONTENT_DIR = path.join(__dirname, '../src/app/content');

// 主菜单
async function main() {
  console.log('\n🎮 Phigros 内容管理系统\n');
  console.log('💡 提示: 添加新曲速递时，只需输入定数(如 15.8)');
  console.log('   等级(如 15)会自动根据定数向下取整计算\n');

  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: '请选择操作',
    choices: [
      { title: '📢 添加公告', value: 'add-announcement' },
      { title: '🎵 添加新曲速递', value: 'add-song-update' },
      { title: '📋 查看所有公告', value: 'list-announcements' },
      { title: '📋 查看所有新曲速递', value: 'list-updates' },
      { title: '⚙️  维护配置管理', value: 'maintenance-config' },
      { title: '✏️  编辑内容', value: 'edit' },
      { title: '❌ 退出', value: 'exit' }
    ]
  });

  if (!action || action === 'exit') {
    console.log('\n👋 再见！\n');
    return;
  }

  switch (action) {
    case 'add-announcement':
      await addAnnouncement();
      break;
    case 'add-song-update':
      await addSongUpdate();
      break;
    case 'list-announcements':
      await listAnnouncements();
      break;
    case 'list-updates':
      await listSongUpdates();
      break;
    case 'maintenance-config':
      await maintenanceConfigMenu();
      break;
    case 'edit':
      console.log('\n💡 提示: 请直接编辑 src/app/content/ 目录下的 .md 文件\n');
      break;
  }

  // 询问是否继续
  const { continueAction } = await prompts({
    type: 'confirm',
    name: 'continueAction',
    message: '继续其他操作?',
    initial: true
  });

  if (continueAction) {
    await main();
  } else {
    console.log('\n👋 再见！\n');
  }
}

// 添加公告
async function addAnnouncement() {
  console.log('\n📢 添加新公告\n');

  const response = await prompts([
    {
      type: 'text',
      name: 'title',
      message: '公告标题:',
      validate: v => v.length > 0 || '标题不能为空'
    },
    {
      type: 'select',
      name: 'type',
      message: '公告类型:',
      choices: [
        { title: '📘 普通信息 (info)', value: 'info' },
        { title: '⚠️  警告 (warning)', value: 'warning' },
        { title: '🔧 维护通知 (maintenance)', value: 'maintenance' }
      ]
    },
    {
      type: 'select',
      name: 'priority',
      message: '优先级:',
      choices: [
        { title: '🔴 高 (high)', value: 'high' },
        { title: '🟡 中 (medium)', value: 'medium' },
        { title: '🟢 低 (low)', value: 'low' }
      ]
    },
    {
      type: 'confirm',
      name: 'dismissible',
      message: '允许用户"不再提示"?',
      initial: true
    },
    {
      type: 'text',
      name: 'content',
      message: '公告内容 (支持Markdown格式):',
      validate: v => v.length > 0 || '内容不能为空'
    }
  ]);

  if (!response.title || !response.content) {
    console.log('❌ 操作已取消');
    return;
  }

  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const timestamp = now.getTime();
  const slug = slugify(response.title);
  const filename = `${date}-${slug}.md`;
  const filepath = path.join(CONTENT_DIR, 'announcements', filename);

  // 检查文件是否已存在
  if (fs.existsSync(filepath)) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `文件 ${filename} 已存在，是否覆盖?`,
      initial: false
    });
    
    if (!overwrite) {
      console.log('❌ 操作已取消');
      return;
    }
  }

  const frontMatter = {
    id: `announcement-${date}-${timestamp}`,
    title: response.title,
    type: response.type,
    publishDate: now.toISOString(),
    enabled: true,
    dismissible: response.dismissible,
    priority: response.priority
  };

  const content = `---
${yaml.dump(frontMatter, { lineWidth: -1 })}---

${response.content}
`;

  fs.writeFileSync(filepath, content, 'utf-8');
  console.log(`\n✅ 公告已创建: ${filename}\n`);
  console.log(`📁 文件路径: ${filepath}\n`);
}

// 添加新曲速递
async function addSongUpdate() {
  console.log('\n🎵 添加新曲速递\n');

  const basicInfo = await prompts([
    {
      type: 'text',
      name: 'version',
      message: '版本号 (例如 4.8.0):',
      validate: v => /^\d+\.\d+\.\d+$/.test(v) || '格式错误，应为 x.y.z'
    },
    {
      type: 'date',
      name: 'updateDate',
      message: '更新日期:',
      initial: new Date(),
      mask: 'YYYY-MM-DD'
    }
  ]);

  if (!basicInfo.version) {
    console.log('❌ 操作已取消');
    return;
  }

  // 选择录入方式
  const { importMode } = await prompts({
    type: 'select',
    name: 'importMode',
    message: '选择曲目录入方式:',
    choices: [
      { title: '📥 CSV 逐行导入', value: 'csv' },
      { title: '✍️  手动逐首录入', value: 'manual' }
    ],
    initial: 0
  });

  // 添加曲目
  const songs = [];
  let addMore = true;

  if (importMode === 'csv') {
    await csvImportInteractive(songs);
    // 导入完成后允许继续切换为手动补充
    const { switchToManual } = await prompts({
      type: 'confirm',
      name: 'switchToManual',
      message: '是否切换到手动继续添加/补充? (已导入的会保留)',
      initial: false
    });
    addMore = switchToManual || songs.length === 0; // 若没有导入任何歌曲则进入手动
  }

  if (addMore) {
    console.log('\n📝 开始添加曲目信息...\n');
    await manualAddInteractive(songs);
  }

  if (songs.length === 0) {
    console.log('❌ 没有添加任何曲目，操作已取消');
    return;
  }

  // 生成Markdown文件前的预览与确认，可回到 CSV/手动继续编辑
  const date = basicInfo.updateDate.toISOString().split('T')[0];
  const filename = `${date}-update-${basicInfo.version}.md`;
  const filepath = path.join(CONTENT_DIR, 'song-updates', filename);

  if (fs.existsSync(filepath)) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `文件 ${filename} 已存在，是否覆盖?`,
      initial: false
    });
    
    if (!overwrite) {
      console.log('❌ 操作已取消');
      return;
    }
  }

  const frontMatter = {
    updateId: `update-${date}`,
    updateDate: basicInfo.updateDate.toISOString(),
    version: basicInfo.version,
    enabled: true
  };

  // 预览与确认循环
  while (true) {
    if (songs.length === 0) {
      console.log('\n📭 暂无曲目，无法生成。');
      const { nextAction } = await prompts({
        type: 'select', name: 'nextAction', message: '选择操作:',
        choices: [
          { title: '📥 返回 CSV 逐行导入', value: 'csv' },
          { title: '✍️  切换到手动输入', value: 'manual' },
          { title: '❌ 取消', value: 'cancel' }
        ]
      });
      if (nextAction === 'cancel' || !nextAction) return;
      if (nextAction === 'csv') { await csvImportInteractive(songs); continue; }
      if (nextAction === 'manual') { await manualAddInteractive(songs); continue; }
    }

    console.log(`\n📋 将要生成 ${songs.length} 首曲目:`);
    songs.forEach((s, i) => {
      const diffs = s.charts.map(c => `${c.diff}:${typeof c.constant === 'number' ? c.constant.toFixed(1) : c.constant}`).join(', ');
      console.log(`${i + 1}. ${s.name} — ${s.artist}${s.illustrator ? `（曲绘: ${s.illustrator}）` : ''} | ${diffs}`);
    });

    const { confirmGenerate } = await prompts({ type: 'confirm', name: 'confirmGenerate', message: '确认生成该新曲速递内容?', initial: true });
    if (confirmGenerate) break;

    const { next } = await prompts({
      type: 'select', name: 'next', message: '继续编辑方式:',
      choices: [
        { title: '📥 返回 CSV 逐行导入', value: 'csv' },
        { title: '✍️  切换到手动输入', value: 'manual' },
        { title: '❌  取消本次操作', value: 'cancel' }
      ]
    });

    if (next === 'cancel' || !next) return;
    if (next === 'csv') { await csvImportInteractive(songs); continue; }
    if (next === 'manual') { await manualAddInteractive(songs); continue; }
  }

  let markdown = `---
${yaml.dump(frontMatter, { lineWidth: -1 })}---

# Phigros ${basicInfo.version} 新曲速递

## 新增曲目

`;

  songs.forEach(song => {
    markdown += `### ${song.name}\n\n`;
    markdown += `- **艺术家**: ${song.artist}\n`;
    if (song.illustrator) {
      markdown += `- **曲绘**: ${song.illustrator}\n`;
    }
    markdown += `- **定数**:\n`;
    
    song.charts.forEach(chart => {
      // 格式化定数，保留1位小数
      const formattedConstant = typeof chart.constant === 'number' 
        ? chart.constant.toFixed(1) 
        : parseFloat(chart.constant).toFixed(1);
      markdown += `  - ${chart.diff}: ${formattedConstant}\n`;
    });
    
    if (song.note) {
      markdown += `- **备注**: ${song.note}\n`;
    }
    
    markdown += '\n';
  });

  // 询问更新说明
  const { updateNote } = await prompts({
    type: 'text',
    name: 'updateNote',
    message: '更新说明 (可选):'
  });

  if (updateNote) {
    markdown += `---\n\n**更新说明**: ${updateNote}\n`;
  }

  fs.writeFileSync(filepath, markdown, 'utf-8');
  console.log(`\n✅ 新曲速递已创建: ${filename}\n`);
  console.log(`📁 文件路径: ${filepath}\n`);
  console.log(`📊 共添加 ${songs.length} 首曲目\n`);
}

// CSV 逐行导入
async function csvImportInteractive(songs) {
  console.log('\n📥 CSV 逐行导入模式');
  console.log('示例:');
  console.log('id,song,composer,illustrator,EZ,HD,IN,AT');
  console.log('StardustRAY.kanonevsBlackY,Stardust:RAY,kanone vs. BlackY,SEGA (V17AMax modified),6.0,12.5,16.5,17.2');
  console.log('说明: id 将被忽略；illustrator 映射为曲绘；缺失的 AT 表示无该难度；支持 UTF-8 中文。\n');

  let done = false;
  while (!done) {
    const { action } = await prompts({
      type: 'select',
      name: 'action',
      message: 'CSV 导入操作:',
      choices: [
        { title: '➡️ 输入/粘贴一行 CSV', value: 'input' },
        { title: '👀 查看已添加', value: 'view' },
        { title: '↩️ 撤销上一条', value: 'undo' },
        { title: '✅ 完成导入', value: 'finish' },
        { title: '✍️ 切换到手动输入', value: 'switch' },
        { title: '❌ 取消', value: 'cancel' }
      ]
    });

    if (!action || action === 'cancel') break;
    if (action === 'finish' || action === 'switch') break;

    if (action === 'view') {
      if (songs.length === 0) {
        console.log('\n📭 暂无已添加曲目\n');
      } else {
        console.log(`\n📋 已添加 ${songs.length} 首:`);
        songs.forEach((s, i) => {
          const diffs = s.charts.map(c => c.diff).join(', ');
          console.log(`${i + 1}. ${s.name} — ${s.artist}${s.illustrator ? `（曲绘: ${s.illustrator}）` : ''} [${diffs}]`);
        });
        console.log('');
      }
      continue;
    }

    if (action === 'undo') {
      if (songs.length === 0) {
        console.log('⚠️ 无可撤销的曲目');
      } else {
        const last = songs[songs.length - 1];
        const { confirm } = await prompts({
          type: 'confirm',
          name: 'confirm',
          message: `撤销: ${last.name} — ${last.artist}?`,
          initial: true
        });
        if (confirm) {
          songs.pop();
          console.log('✅ 已撤销上一条');
        }
      }
      continue;
    }

    if (action === 'input') {
      // 使用原生 readline 简化输入，避免 Windows 终端重复渲染
      const line = await readRawLine('粘贴一行 CSV: ');
      if (!line || !String(line).trim()) continue;

      if (/\b(song|composer|illustrator|ez|hd|in|at)\b/i.test(line)) {
        const { skip } = await prompts({ type: 'confirm', name: 'skip', message: '检测到表头/说明行，是否跳过?', initial: true });
        if (skip) continue;
      }

      const parsed = buildSongFromCsvLine(line);
      if (parsed.error) {
        console.log(`❌ 解析失败: ${parsed.error}`);
        const { retry } = await prompts({ type: 'confirm', name: 'retry', message: '是否重新输入?', initial: true });
        if (retry) continue; else continue;
      }

      const s = parsed.song;
      console.log('\n预览:');
      console.log(`- 曲名: ${s.name}`);
      console.log(`- 曲师: ${s.artist}`);
      if (s.illustrator) console.log(`- 曲绘: ${s.illustrator}`);
      if (s.charts.length) {
        console.log('- 定数:');
        s.charts.forEach(c => console.log(`  - ${c.diff}: ${typeof c.constant === 'number' ? c.constant.toFixed(1) : c.constant}`));
      } else {
        console.log('- 定数: 无');
      }

      const { decide } = await prompts({
        type: 'select',
        name: 'decide',
        message: '确认添加该曲目?',
        choices: [
          { title: '✅ 添加', value: 'add' },
          { title: '✏️ 重输', value: 'retry' },
          { title: '⏭️ 跳过', value: 'skip' }
        ]
      });

      if (decide === 'add') {
        songs.push(s);
        console.log('✅ 已添加');
      } else if (decide === 'retry') {
        continue;
      } else {
        // skip
      }

      continue;
    }
  }

  // 返回时，由上层决定是否切换到手动
}

// 手动录入
async function manualAddInteractive(songs) {
  let addMore = true;
  while (addMore) {
    console.log(`\n--- 第 ${songs.length + 1} 首曲目 ---\n`);

    const song = await prompts([
      { type: 'text', name: 'name', message: '曲名:', validate: v => v.length > 0 || '曲名不能为空' },
      { type: 'text', name: 'artist', message: '艺术家:', validate: v => v.length > 0 || '艺术家不能为空' },
      { type: 'text', name: 'illustrator', message: '曲绘 (可选，支持 UTF-8 中文):' }
    ]);

    if (!song.name || !song.artist) {
      console.log('❌ 跳过此曲目');
      const { more } = await prompts({ type: 'confirm', name: 'more', message: '继续添加曲目?', initial: true });
      addMore = more; continue;
    }

    const charts = [];
    for (const diff of ['EZ','HD','IN','AT']) {
      const { addDiff } = await prompts({ type: 'confirm', name: 'addDiff', message: `添加 ${diff} 难度?`, initial: true });
      if (addDiff) {
        const chartInfo = await prompts({
          type: 'text', name: 'constant',
          message: `${diff} 定数 (支持小数，如 3.2, 14.5, 15.8):`,
          validate: v => {
            const num = parseFloat(v);
            if (isNaN(num)) return '请输入有效的数字';
            if (num < 1.0 || num > 20.0) return '定数应在 1.0-20.0 之间';
            return true;
          }
        });
        if (chartInfo.constant) {
          const constant = parseFloat(chartInfo.constant);
          const level = Math.floor(constant);
          charts.push({ diff, level, constant });
        }
      }
    }

    const { note } = await prompts({ type: 'text', name: 'note', message: '备注 (可选，直接回车跳过):' });
    songs.push({ ...song, charts, note });

    const { more } = await prompts({ type: 'confirm', name: 'more', message: '继续添加曲目?', initial: true });
    addMore = more;
  }
}

// 简化的单行输入，避免 prompts 在某些 Windows 终端的多行重绘问题
function readRawLine(question) {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (process.stdin.setEncoding) process.stdin.setEncoding('utf8');
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function buildSongFromCsvLine(line) {
  try {
    const cols = parseCsvLine(line);
    const get = (i) => (cols[i] || '').trim();

    const name = get(1);
    const artist = get(2);
    const illustrator = get(3);

    if (!name || !artist) {
      return { error: '曲名或曲师缺失' };
    }

    const diffs = [
      { diff: 'EZ', v: get(4) },
      { diff: 'HD', v: get(5) },
      { diff: 'IN', v: get(6) },
      { diff: 'AT', v: get(7) }
    ];

    const charts = [];
    for (const d of diffs) {
      if (d.v === undefined || d.v === null || d.v === '') continue;
      const num = parseConstant(d.v);
      if (Number.isNaN(num)) {
        return { error: `${d.diff} 定数无效: "${d.v}"` };
      }
      if (num < 1.0 || num > 20.0) {
        return { error: `${d.diff} 定数超出范围: ${num}` };
      }
      charts.push({ diff: d.diff, level: Math.floor(num), constant: num });
    }

    if (charts.length === 0) {
      return { error: '缺少任何难度定数 (EZ/HD/IN/AT 均为空)' };
    }

    return { song: { name, artist, illustrator, charts } };
  } catch (e) {
    return { error: e.message || '未知错误' };
  }
}

function parseConstant(v) {
  const t = String(v).trim();
  const num = parseFloat(t);
  return num;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// 列出所有公告
async function listAnnouncements() {
  const dir = path.join(CONTENT_DIR, 'announcements');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    console.log('\n📭 暂无公告\n');
    return;
  }

  console.log(`\n📢 共有 ${files.length} 条公告:\n`);

  files.forEach((file, index) => {
    const filepath = path.join(dir, file);
    const content = fs.readFileSync(filepath, 'utf-8');
    const { data } = require('gray-matter')(content);
    
    const statusIcon = data.enabled ? '✅' : '❌';
    const typeIcon = data.type === 'info' ? '📘' : data.type === 'warning' ? '⚠️' : '🔧';
    
    console.log(`${index + 1}. ${statusIcon} ${typeIcon} ${data.title}`);
    console.log(`   文件: ${file}`);
    console.log(`   日期: ${new Date(data.publishDate).toLocaleString('zh-CN')}`);
    console.log('');
  });
}

// 列出所有新曲速递
async function listSongUpdates() {
  const dir = path.join(CONTENT_DIR, 'song-updates');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    console.log('\n📭 暂无新曲速递\n');
    return;
  }

  console.log(`\n🎵 共有 ${files.length} 条新曲速递:\n`);

  files.forEach((file, index) => {
    const filepath = path.join(dir, file);
    const content = fs.readFileSync(filepath, 'utf-8');
    const { data } = require('gray-matter')(content);
    
    const statusIcon = data.enabled ? '✅' : '❌';
    
    console.log(`${index + 1}. ${statusIcon} Phigros ${data.version}`);
    console.log(`   文件: ${file}`);
    console.log(`   日期: ${new Date(data.updateDate).toLocaleString('zh-CN')}`);
    console.log('');
  });
}

// 维护配置管理菜单
async function maintenanceConfigMenu() {
  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: '维护配置管理',
    choices: [
      { title: '👁️  查看当前配置', value: 'view' },
      { title: '✏️  编辑配置', value: 'edit' },
      { title: '🔄 快速测试（立即进入维护）', value: 'quick-test' },
      { title: '↩️  返回主菜单', value: 'back' }
    ]
  });

  if (!action || action === 'back') {
    return;
  }

  switch (action) {
    case 'view':
      await viewMaintenanceConfig();
      break;
    case 'edit':
      await editMaintenanceConfig();
      break;
    case 'quick-test':
      await quickTestMaintenance();
      break;
  }

  // 继续操作
  await maintenanceConfigMenu();
}

// 查看维护配置
async function viewMaintenanceConfig() {
  const config = readMaintenanceConfig();
  
  console.log('\n⚙️  当前维护配置:\n');
  console.log(`✅ 启用状态: ${config.enabled ? '🟢 已启用' : '🔴 已禁用'}`);
  console.log(`📅 维护开始: ${config.startTime}`);
  console.log(`📅 维护结束: ${config.endTime}`);
  console.log(`📢 提前通知: ${config.preNoticeDays} 天`);
  console.log(`📝 标题: ${config.title}`);
  console.log(`📝 维护消息:`);
  console.log(`   ${config.message.trim().replace(/\n/g, '\n   ')}`);
  console.log(`📝 横幅消息:`);
  console.log(`   ${config.bannerMessage.trim().replace(/\n/g, '\n   ')}`);
  console.log('');

  // 显示当前状态
  const now = new Date();
  const start = new Date(config.startTime);
  const end = new Date(config.endTime);
  const preNoticeTime = new Date(start);
  preNoticeTime.setDate(preNoticeTime.getDate() - config.preNoticeDays);

  if (config.enabled) {
    if (now >= start && now < end) {
      console.log('🔴 当前状态: 维护中');
    } else if (now >= preNoticeTime && now < start) {
      console.log('🟡 当前状态: 预告期（显示横幅）');
    } else if (now >= end) {
      console.log('🟢 当前状态: 维护已结束');
    } else {
      console.log('⏳ 当前状态: 等待预告期');
    }
  } else {
    console.log('⚪ 当前状态: 维护模式未启用');
  }
  console.log('');
}

// 编辑维护配置
async function editMaintenanceConfig() {
  const config = readMaintenanceConfig();
  
  console.log('\n✏️  编辑维护配置\n');

  const response = await prompts([
    {
      type: 'confirm',
      name: 'enabled',
      message: '启用维护模式检查?',
      initial: config.enabled
    },
    {
      type: 'text',
      name: 'startTime',
      message: '维护开始时间 (格式: YYYY-MM-DDTHH:mm:ss):',
      initial: config.startTime,
      validate: v => {
        try {
          new Date(v);
          return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v) || '格式错误';
        } catch {
          return '无效的日期';
        }
      }
    },
    {
      type: 'text',
      name: 'endTime',
      message: '维护结束时间 (格式: YYYY-MM-DDTHH:mm:ss):',
      initial: config.endTime,
      validate: v => {
        try {
          new Date(v);
          return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v) || '格式错误';
        } catch {
          return '无效的日期';
        }
      }
    },
    {
      type: 'number',
      name: 'preNoticeDays',
      message: '提前多少天显示预告横幅?',
      initial: config.preNoticeDays,
      min: 0,
      max: 30
    },
    {
      type: 'text',
      name: 'title',
      message: '维护标题:',
      initial: config.title
    },
    {
      type: 'text',
      name: 'message',
      message: '维护消息 (支持HTML):',
      initial: config.message.trim()
    },
    {
      type: 'text',
      name: 'bannerMessage',
      message: '横幅消息 (支持HTML):',
      initial: config.bannerMessage.trim()
    }
  ]);

  if (Object.keys(response).length === 0) {
    console.log('❌ 操作已取消');
    return;
  }

  // 确认保存
  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: '确认保存配置?',
    initial: true
  });

  if (!confirm) {
    console.log('❌ 操作已取消');
    return;
  }

  writeMaintenanceConfig(response);
  console.log('\n✅ 维护配置已保存!\n');
  console.log('💡 提示: 配置已更新，重启开发服务器后生效\n');
}

// 快速测试维护模式
async function quickTestMaintenance() {
  console.log('\n🔄 快速测试维护模式\n');
  
  const { testType } = await prompts({
    type: 'select',
    name: 'testType',
    message: '选择测试类型:',
    choices: [
      { title: '测试维护覆盖层（立即进入维护）', value: 'overlay' },
      { title: '测试预告横幅（5分钟后维护）', value: 'banner' },
      { title: '取消', value: 'cancel' }
    ]
  });

  if (testType === 'cancel') {
    return;
  }

  const now = new Date();
  let config;

  if (testType === 'overlay') {
    // 立即进入维护，持续10分钟
    const endTime = new Date(now.getTime() + 10 * 60 * 1000);
    config = {
      enabled: true,
      startTime: toLocalISOString(new Date(now.getTime() - 1000)),
      endTime: toLocalISOString(endTime),
      preNoticeDays: 0,
      title: '测试维护通知',
      message: `
    这是测试维护覆盖层。<br/>
    <strong>测试将在 ${endTime.toLocaleString('zh-CN')} 结束</strong><br/><br/>
    请刷新页面查看效果。
  `,
      bannerMessage: '测试横幅消息'
    };
  } else {
    // 测试预告横幅：让横幅立即显示
    // 技巧：将维护时间设置为2小时后，preNoticeDays设置为一个很大的天数
    // 这样预告期开始时间 = 2小时后 - 999天 = 很久以前，横幅立即显示
    const startTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2小时后
    const endTime = new Date(startTime.getTime() + 1 * 60 * 60 * 1000); // 维护1小时
    
    config = {
      enabled: true,
      startTime: toLocalISOString(startTime),
      endTime: toLocalISOString(endTime),
      preNoticeDays: 999, // 提前999天通知，确保预告期立即开始
      title: '测试维护通知',
      message: '测试维护消息（此测试不会真正进入维护）',
      bannerMessage: `
    <strong>🧪 测试横幅：</strong>
    这是预告横幅的测试效果。<br/>
    在正式维护前，此橙色横幅会显示在页面顶部。<br/>
    用户可以点击右侧 <strong>✕</strong> 关闭，关闭后不再显示。
  `
    };
  }

  writeMaintenanceConfig(config);
  
  console.log('✅ 测试配置已生效！');
  console.log('');
  console.log('📌 测试详情:');
  if (testType === 'overlay') {
    console.log('   - 维护模式已启用，立即生效');
    console.log('   - 页面将显示全屏维护覆盖');
    console.log(`   - 测试将在 ${new Date(now.getTime() + 10 * 60 * 1000).toLocaleString('zh-CN')} 自动结束`);
  } else {
    console.log('   - 预告横幅已启用，立即生效');
    console.log('   - 页面顶部将显示橙色横幅');
    console.log('   - 横幅可以手动关闭（点击 ✕ 按钮）');
    console.log('   - 这是测试模式，实际不会进入维护');
  }
  console.log('');
  console.log('💡 提示:');
  console.log('   1. 请刷新浏览器查看效果');
  console.log('   2. 测试完成后记得运行此命令禁用维护模式');
  console.log('   3. 或编辑配置文件将 enabled 改为 false');
  console.log('');
}

// 读取维护配置
function readMaintenanceConfig() {
  const configPath = path.join(__dirname, '../src/app/config/maintenance.config.ts');
  const content = fs.readFileSync(configPath, 'utf-8');
  
  // 简单的配置解析
  const config = {
    enabled: /enabled:\s*(true|false)/.exec(content)?.[1] === 'true',
    startTime: /startTime:\s*'([^']+)'/.exec(content)?.[1] || '',
    endTime: /endTime:\s*'([^']+)'/.exec(content)?.[1] || '',
    preNoticeDays: parseInt(/preNoticeDays:\s*(\d+)/.exec(content)?.[1] || '3'),
    title: /title:\s*'([^']+)'/.exec(content)?.[1] || '',
    message: extractMultilineString(content, 'message'),
    bannerMessage: extractMultilineString(content, 'bannerMessage')
  };
  
  return config;
}

// 提取多行字符串
function extractMultilineString(content, key) {
  const regex = new RegExp(`${key}:\\s*\`([\\s\\S]*?)\``, 'm');
  const match = regex.exec(content);
  return match ? match[1].trim() : '';
}

// 写入维护配置
function writeMaintenanceConfig(config) {
  const configPath = path.join(__dirname, '../src/app/config/maintenance.config.ts');
  
  const content = `/**
 * 维护模式配置
 * 
 * 使用说明：
 * 1. 修改 enabled 为 true 启用维护模式检查
 * 2. 设置 startTime 和 endTime 指定维护时间段
 * 3. 设置 preNoticeDays 决定提前多少天显示预告横幅
 * 4. 自定义 title、message 和 bannerMessage 文本
 */

export interface MaintenanceConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  preNoticeDays: number;
  title: string;
  message: string;
  bannerMessage: string;
}

export const maintenanceConfig: MaintenanceConfig = {
  // 是否启用维护模式检查（true: 启用, false: 禁用）
  enabled: ${config.enabled},

  // 维护开始时间（ISO 8601 格式：YYYY-MM-DDTHH:mm:ss）
  // 示例：'2025-01-20T09:00:00' 表示 2025年1月20日 09:00
  startTime: '${config.startTime}',

  // 维护结束时间（ISO 8601 格式）
  endTime: '${config.endTime}',

  // 提前多少天显示维护预告横幅（例如：3 表示提前3天显示）
  preNoticeDays: ${config.preNoticeDays},

  // 维护期间显示的标题
  title: '${config.title}',

  // 维护期间显示的消息内容（支持 HTML）
  message: \`
${config.message}
  \`,

  // 维护预告横幅消息（支持 HTML）
  bannerMessage: \`
${config.bannerMessage}
  \`,
};

/**
 * 检查当前是否在维护期间
 */
export function isInMaintenance(): boolean {
  if (!maintenanceConfig.enabled) {
    return false;
  }

  const now = new Date();
  const start = new Date(maintenanceConfig.startTime);
  const end = new Date(maintenanceConfig.endTime);

  return now >= start && now < end;
}

/**
 * 检查是否应该显示维护预告横幅
 */
export function shouldShowMaintenanceBanner(): boolean {
  if (!maintenanceConfig.enabled) {
    return false;
  }

  const now = new Date();
  const start = new Date(maintenanceConfig.startTime);
  const preNoticeTime = new Date(start);
  preNoticeTime.setDate(preNoticeTime.getDate() - maintenanceConfig.preNoticeDays);

  return now >= preNoticeTime && now < start;
}
`;

  fs.writeFileSync(configPath, content, 'utf-8');
}

// 工具函数: 将 Date 转换为本地时间的 ISO 字符串（YYYY-MM-DDTHH:mm:ss）
function toLocalISOString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

// 工具函数: 生成URL友好的slug
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50); // 限制长度
}

// 启动程序
main().catch(err => {
  console.error('❌ 发生错误:', err);
  process.exit(1);
});
