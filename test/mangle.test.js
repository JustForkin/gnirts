'use strict';

const expect = require('chai').expect,
  common = require('./common'),
  gnirts = require('../lib/gnirts');

function escapeMeta(text) {
  return text.replace(/[\x00-\x7f]/g, // eslint-disable-line no-control-regex
    function(s) { return '\\x' + ('00' + s.charCodeAt().toString(16)).substr(-2); });
}

describe('mangle()', () => {

  describe('directive pattern', () => {
    const LF = '\x0A', CRLF = '\x0D\x0A';

    it('should catch `/* @mangle */ ... /* @/mangle */`', () => {
      const str = '/* @mangle */ "" /* @/mangle */',
        code = gnirts.mangle(str);
      expect(code).to.equal("''");
    });

    it('should catch `/* @mangle */ ... /* @/mangle */` with LF', () => {
      const str = `/*   ${LF}@mangle   ${LF}${LF}*/ ${LF}${LF}  ""   ${LF}/*   ${LF}@/mangle   ${LF}*/`,
        code = gnirts.mangle(str);
      expect(code).to.equal("''");
    });

    it('should catch `/* @mangle */ ... /* @/mangle */` with CRLF', () => {
      const str = `/*   ${CRLF}@mangle   ${CRLF}${CRLF}*/ ${CRLF}${CRLF}` +
          `  ""   ${CRLF}/*   ${CRLF}@/mangle   ${CRLF}*/`,
        code = gnirts.mangle(str);
      expect(code).to.equal("''");
    });

    it('should catch `// @mangle ... // @/mangle` with LF', () => {
      const str = `//   @mangle ${LF}  "" ${LF} //  @/mangle`,
        code = gnirts.mangle(str);
      expect(code).to.equal("''");
    });

    it('should catch `// @mangle ... // @/mangle` with LF (eol)', () => {
      const str = `//   @mangle ${LF}  "" ${LF} //  @/mangle${LF}`,
        code = gnirts.mangle(str);
      expect(code).to.equal(`''${LF}`);
    });

    it('should catch `// @mangle ... // @/mangle` with CRLF', () => {
      const str = `//   @mangle ${CRLF}  "" ${CRLF} //  @/mangle`,
        code = gnirts.mangle(str);
      expect(code).to.equal("''");
    });

    it('should catch `// @mangle ... // @/mangle` with CRLF (eol)', () => {
      const str = `//   @mangle ${CRLF}  "" ${CRLF} //  @/mangle${CRLF}`,
        code = gnirts.mangle(str);
      expect(code).to.equal(`''${CRLF}`);
    });

    it('should catch mixed code', () => {
      const str = `/*   ${LF}@mangle   ${LF}${LF}*/ ${LF}${LF}  ""   ${LF}/*   ${LF}@/mangle   ${LF}*/` +
          `foo//   @mangle ${LF}  "" ${LF} //  @/mangle${LF}`,
        code = gnirts.mangle(str);
      expect(code).to.equal(`''foo''${LF}`);
    });

    it('should ignore comment', () => {
      const str = `/*@mangle*/${LF}/*CMT*/${LF}//CMT${LF}""${LF}/*CMT*/${LF}//CMT${LF}/*@/mangle*/`,
        code = gnirts.mangle(str);
      expect(code).to.equal("''");
    });

  });

  describe('case of the literal', () => {

    it('should get simple literal', () => {
      const val = 'foo',
        str = `v1 = /* @mangle */ '${val}' /* @/mangle */;`;
      common.random.returns(0.99); // Make length of part be 2

      const code = gnirts.mangle(str);
      // 3 part
      expect((new RegExp(`^v1 = ${common.getPattern4string()}\\+` +
          `${common.getPattern4string()}\\+${common.getPattern4string()};$`))
        .test(code)).to.be.true;
      expect(common.code2str(code.replace(/^v1 =/, ''))).to.equal(val);

      common.random.reset();
    });

    it('should copy `+`', () => {
      const val = 'foo',
        str = `v1 = v2 /* @mangle */ + '${val}'+/* @/mangle */v3;`;
      common.random.returns(0.99); // Make length of part be 2

      const code = gnirts.mangle(str);
      // 3 part
      expect((new RegExp(`^v1 = v2 \\+${common.getPattern4string()}\\+` +
          `${common.getPattern4string()}\\+${common.getPattern4string()}\\+v3;$`))
        .test(code)).to.be.true;
      expect(common.code2str(code.replace(/^v1 = v2 \+(.+)\+v3;$/, '$1'))).to.equal(val);

      common.random.reset();
    });

  });

  describe('case of the match', () => {

    describe('getCode4match()', () => {

      it('should return `\'\'` if input is empty string with `===`', () => {
        const str = '/*@mangle*/ v1===\'\' //  @/mangle',
          code = gnirts.mangle(str);
        expect(code).to.equal('v1===\'\'');
      });

      it('should return `\'\'` if input is empty string with `!==`', () => {
        const str = '/*@mangle*/ v1!==\'\' //  @/mangle',
          code = gnirts.mangle(str);
        expect(code).to.equal('!(v1===\'\')');
      });

      common.testCases.forEach(testCase => {
        [0, 0.99].forEach(caseRandom => {
          it(`should cover ${testCase.title}, random: ${caseRandom}`, () => {
            common.random.returns(caseRandom);
            const str = `/* @mangle */ v1 === '${escapeMeta(testCase.value)}'/* @/mangle */`,
              code = gnirts.mangle(str);
            expect(code).to.not.equal(str);
            expect(common.code2str(
              `(()=>{var v1='${escapeMeta(testCase.value)}';return ${code};})()`)).to.be.true;
            common.random.reset();
          });
        });
      });

      it('should split the string and compare each part, length: 1', () => {
        // Fix state of common#tryR36
        common.random.returns(0);
        if (!(new RegExp(`^${common.getPattern4string()}$`)).test(gnirts.getCode('a'))) {
          common.getPattern4string(); // Toggle
        }

        const val = 'abc',
          str = `/* @mangle */ v1 === '${val}'/* @/mangle */`;
        common.random.returns(0); // Make length of part be 1

        const code = gnirts.mangle(str),
          pattern = common.getPattern4match(3); // 3 parts
        expect((new RegExp(pattern)).test(code)).to.be.true;
        expect(common.code2str(`(()=>{var v1='${val}';return ${code};})()`)).to.be.true;

        common.random.reset();
      });

    });
  });

  describe('invalid pattern', () => {

    it('should throw when `/* @mangle */ foo /* @/mangle */`', () => {
      const str = '/* @mangle */ foo /* @/mangle */';
      expect(() => { gnirts.mangle(str); }).to.throw('Invalid directive: foo');
    });

    it('should throw when `/* @mangle */ \'\' + foo + \'\' /* @/mangle */`', () => {
      const str = '/* @mangle */ \'\' + foo + \'\' /* @/mangle */';
      expect(() => { gnirts.mangle(str); }).to.throw(/Invalid code:/);
    });

  });

});
