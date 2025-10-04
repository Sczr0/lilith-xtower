#!/usr/bin/env node

/**
 * 测试脚本 - 验证定数小数输入是否正常工作
 */

// 测试定数验证逻辑
function testConstantValidation() {
  console.log('🧪 测试定数验证逻辑\n');

  const testCases = [
    { input: '15.8', expected: true, value: 15.8, level: 15 },
    { input: '14.5', expected: true, value: 14.5, level: 14 },
    { input: '16.3', expected: true, value: 16.3, level: 16 },
    { input: '10', expected: true, value: 10.0, level: 10 },
    { input: '18.0', expected: true, value: 18.0, level: 18 },
    { input: '20.0', expected: true, value: 20.0, level: 20 },
    { input: '1.0', expected: true, value: 1.0, level: 1 },
    { input: '3.2', expected: true, value: 3.2, level: 3 },
    { input: '0.5', expected: false, reason: '定数应在 1.0-20.0 之间' },
    { input: '21.0', expected: false, reason: '定数应在 1.0-20.0 之间' },
    { input: 'abc', expected: false, reason: '请输入有效的数字' },
    { input: '', expected: false, reason: '请输入有效的数字' },
  ];

  const validate = (v) => {
    const num = parseFloat(v);
    if (isNaN(num)) return '请输入有效的数字';
    if (num < 1.0 || num > 20.0) return '定数应在 1.0-20.0 之间';
    return true;
  };

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    const result = validate(testCase.input);
    const isValid = result === true;
    
    if (isValid === testCase.expected) {
      console.log(`✅ 测试 ${index + 1}: "${testCase.input}" → ${isValid ? '通过' : '拒绝'}`);
      if (isValid) {
        const parsed = parseFloat(testCase.input);
        const level = Math.floor(parsed);
        console.log(`   定数: ${parsed} (期望: ${testCase.value})`);
        console.log(`   等级: ${level} (自动计算，期望: ${testCase.level})`);
        if (Math.abs(parsed - testCase.value) < 0.001 && level === testCase.level) {
          console.log(`   ✓ 数值和等级都正确`);
        } else {
          console.log(`   ✗ 数值或等级不匹配`);
          failed++;
          return;
        }
      } else {
        console.log(`   原因: ${result}`);
      }
      passed++;
    } else {
      console.log(`❌ 测试 ${index + 1}: "${testCase.input}" → 预期 ${testCase.expected ? '通过' : '拒绝'}，实际 ${isValid ? '通过' : '拒绝'}`);
      failed++;
    }
    console.log();
  });

  console.log('\n📊 测试结果:');
  console.log(`   通过: ${passed}/${testCases.length}`);
  console.log(`   失败: ${failed}/${testCases.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！\n');
  } else {
    console.log('\n⚠️  部分测试失败\n');
  }
}

// 测试定数格式化
function testConstantFormatting() {
  console.log('🧪 测试定数格式化逻辑\n');

  const testCases = [
    { input: 15.8, expected: '15.8' },
    { input: 14.5, expected: '14.5' },
    { input: 10, expected: '10.0' },
    { input: 16.33, expected: '16.3' },
    { input: '15.8', expected: '15.8' },
    { input: '14', expected: '14.0' },
  ];

  const format = (constant) => {
    return typeof constant === 'number' 
      ? constant.toFixed(1) 
      : parseFloat(constant).toFixed(1);
  };

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    const result = format(testCase.input);
    
    if (result === testCase.expected) {
      console.log(`✅ 测试 ${index + 1}: ${testCase.input} → "${result}"`);
      passed++;
    } else {
      console.log(`❌ 测试 ${index + 1}: ${testCase.input} → 预期 "${testCase.expected}"，实际 "${result}"`);
      failed++;
    }
  });

  console.log('\n📊 测试结果:');
  console.log(`   通过: ${passed}/${testCases.length}`);
  console.log(`   失败: ${failed}/${testCases.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！\n');
  } else {
    console.log('\n⚠️  部分测试失败\n');
  }
}

// 运行所有测试
console.log('=' .repeat(60));
console.log('内容管理工具 - 定数输入测试');
console.log('=' .repeat(60));
console.log();

testConstantValidation();
console.log('-'.repeat(60));
console.log();
testConstantFormatting();

console.log('=' .repeat(60));
