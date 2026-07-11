// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { reaction } from 'mobx';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { buildKillerXml, KillerContract } from '@/utils/killer-bot';
import { getExecutionSpeed } from '@/utils/execution-speed';
import './ai-assistant.scss';

/**
 * AI Market Scanner + Direct-Fire Auto-Bot.
 *
 * "Load & Run Bot" flow:
 *  1. Injects stake / martingale / TP / SL into the killer-bot XML and loads
 *     it into the Blockly workspace for display.
 *  2. Flips the main Run panel into the "running" state (same signal the big
 *     dashboard Run button uses) so the whole app reflects that a bot is live.
 *  3. Starts a direct-fire trading loop, firing the very instant the previous
 *     contract settles — no artificial delay:
 *       buy (single round-trip) → wait for real settlement → martingale → repeat
 *     This runs continuously until the TP or SL threshold is hit, or the user
 *     clicks "Stop Bot" / the main Stop button.
 *
 * Stake / Take Profit / Stop Loss are plain USD — bot XML stakes/TP/SL are
 * always USD, so the AI must never convert to/from a display currency here.
 *
 * No checkbox required — Load & Run always fires continuously.
 */

const SCAN_SYMBOLS = [
    { label: 'Volatility 10 Index',   symbol: 'R_10',    group: 'Volatility'          },
    { label: 'Volatility 25 Index',   symbol: 'R_25',    group: 'Volatility'          },
    { label: 'Volatility 50 Index',   symbol: 'R_50',    group: 'Volatility'          },
    { label: 'Volatility 75 Index',   symbol: 'R_75',    group: 'Volatility'          },
    { label: 'Volatility 100 Index',  symbol: 'R_100',   group: 'Volatility'          },
    { label: 'Volatility 10 (1s)',    symbol: '1HZ10V',  group: 'Volatility 1s'       },
    { label: 'Volatility 25 (1s)',    symbol: '1HZ25V',  group: 'Volatility 1s'       },
    { label: 'Volatility 50 (1s)',    symbol: '1HZ50V',  group: 'Volatility 1s'       },
    { label: 'Volatility 75 (1s)',    symbol: '1HZ75V',  group: 'Volatility 1s'       },
    { label: 'Volatility 100 (1s)',   symbol: '1HZ100V', group: 'Volatility 1s'       },
    { label: 'Jump 10 Index',         symbol: 'JD10',    group: 'Jump Indices'        },
    { label: 'Jump 25 Index',         symbol: 'JD25',    group: 'Jump Indices'        },
    { label: 'Jump 50 Index',         symbol: 'JD50',    group: 'Jump Indices'        },
    { label: 'Jump 75 Index',         symbol: 'JD75',    group: 'Jump Indices'        },
    { label: 'Jump 100 Index',        symbol: 'JD100',   group: 'Jump Indices'        },
    { label: 'Bear Market Index',     symbol: 'RDBEAR',  group: 'Daily Reset Indices' },
    { label: 'Bull Market Index',     symbol: 'RDBULL',  group: 'Daily Reset Indices' },
    { label: 'Step Index',            symbol: 'stpRNG',  group: 'Step'                },
];

type ContractType = KillerContract;

const CONTRACT_TYPE_MAP: Record<ContractType, string> = {
    over:    'DIGITOVER',
    under:   'DIGITUNDER',
    even:    'DIGITEVEN',
    odd:     'DIGITODD',
    matches: 'DIGITMATCH',
    differs: 'DIGITDIFF',
    rise:    'CALL',
    fall:    'PUT',
};

const NEEDS_BARRIER: Set<ContractType> = new Set(['over', 'under', 'matches', 'differs']);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Full "AHMED SYN EVEN ODD MARKET KILLER 1.2" XML — complete with
// trade_definition (market/init/options), after_purchase (TP/SL/martingale/trade_again),
// and before_purchase (purchase with contract type) blocks.
// buildKillerXml() will dynamically patch symbol, contract type, barrier,
// stake, martingale, TP, SL before loading this into the Bot Builder workspace.
const KILLER_XML_TEMPLATE = `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true" collection="false">
  <variables>
    <variable id="nyrtB]!3ObqjLVHHuJ|5">stake</variable>
    <variable id="rKwHUdT+nn0j5KEZX:TY">initial stake </variable>
    <variable id="B\`@Q*C)!foy!~/E)8n%v">text</variable>
    <variable id="}VK*]CMXvcC-5_Y\`dp6h">TEXT2</variable>
    <variable id="_fr,aLuF-W2EJ2?_;-|K">totalprofit</variable>
    <variable id="1lyZu%^sRY)L\`ABj60;#">totalloss</variable>
    <variable id=",;WqBIU[7qCnbcVf.lZG">Martingale</variable>
  </variables>
  <block type="trade_definition" id="W/vIFq5Tjx;8,?(c_4_$" deletable="false" x="0" y="60">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="ihzWeIz3sG*V/aOV*8x-" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ25V</field>
        <next>
          <block type="trade_definition_tradetype" id="QPUTUl%YtMt2G,jl*8MR" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">evenodd</field>
            <next>
              <block type="trade_definition_contracttype" id="cjfQMi[k#(TGQOkfBUuw" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITEVEN</field>
                <next>
                  <block type="trade_definition_candleinterval" id="V!zDYd|8KTbT3LVZlm=M" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id=",PfP7F=;f/=2-(E5xabO" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="1bI(g?Os8NZ|p.R@e/;y" deletable="false" movable="false">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="M$F.mTtW#X2XN)80x~_">
        <field name="VAR" id="nyrtB]!3ObqjLVHHuJ|5">stake</field>
        <value name="VALUE">
          <block type="math_number" id="~3z)tZ?L(v2Y5A*HguH8">
            <field name="NUM">0.5</field>
          </block>
        </value>
        <next>
          <block type="variables_set" id="~+ip,J;!6xMB:7Bedl6i">
            <field name="VAR" id="rKwHUdT+nn0j5KEZX:TY">initial stake </field>
            <value name="VALUE">
              <block type="math_number" id="TakR.Wu!Ep9Jx8+YV)DE">
                <field name="NUM">0.5</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="NNYt)tQ9be_2bK!tyKGz">
                <field name="VAR" id="_fr,aLuF-W2EJ2?_;-|K">totalprofit</field>
                <value name="VALUE">
                  <block type="math_number" id="fr,Wqt}|b$~Pf_32ST2@">
                    <field name="NUM">2</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set" id="]RSW9QzCfx8SQIpk;uik">
                    <field name="VAR" id="1lyZu%^sRY)L\`ABj60;#">totalloss</field>
                    <value name="VALUE">
                      <block type="math_number" id="u!7Iup%H],~Imh(7QVK3">
                        <field name="NUM">1000</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="jRUznD=LhH_a?d1#l6kc">
                        <field name="VAR" id=",;WqBIU[7qCnbcVf.lZG">Martingale</field>
                        <value name="VALUE">
                          <block type="math_number" id="7==qSBB)+Y3)({R(i0j_">
                            <field name="NUM">2.2</field>
                          </block>
                        </value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="~6pnSPeJb8_JccG+Bx)K">
        <mutation xmlns="http://www.w3.org/1999/xhtml" has_first_barrier="false" has_second_barrier="false" has_prediction="false"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION">
          <shadow type="math_number_positive" id="wIL=dY*+*#]%l:_da)C_">
            <field name="NUM">1</field>
          </shadow>
        </value>
        <value name="AMOUNT">
          <shadow type="math_number_positive" id="r|i#Pcy1q.H,*G_![h3*">
            <field name="NUM">0.35</field>
          </shadow>
          <block type="variables_get" id="qYGQ:=sT8L6DCO3=0BO+">
            <field name="VAR" id="nyrtB]!3ObqjLVHHuJ|5">stake</field>
          </block>
        </value>
      </block>
    </statement>
  </block>
  <block type="after_purchase" id="o2)4jFhq_R1O7.HJN" collapsed="true" x="714" y="60">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="V*7Z7%uP?D:U/K~3G1%M">
        <mutation xmlns="http://www.w3.org/1999/xhtml" elseif="1" else="1"></mutation>
        <value name="IF0">
          <block type="logic_compare" id="_0o.E/oliw!(lRqXgn~U">
            <field name="OP">GTE</field>
            <value name="A">
              <block type="total_profit" id="jVQV2DA]uxL?M-J-V[bZ"></block>
            </value>
            <value name="B">
              <block type="variables_get" id="^}7a,LF8cZu/eN%9(pHl">
                <field name="VAR" id="_fr,aLuF-W2EJ2?_;-|K">totalprofit</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="text_join" id="UqnAy*/=QPy:Exy+AV:a">
            <field name="VARIABLE" id="B\`@Q*C)!foy!~/E)8n%v">text</field>
            <statement name="STACK">
              <block type="text_statement" id="G,;gUmb-hsTrC+=+v*w9">
                <value name="TEXT">
                  <shadow type="text" id="X%RxW@#{t]k*o#$?f{O">
                    <field name="TEXT">PROFIT TARGET HIT — STOPPING BOT</field>
                  </shadow>
                </value>
              </block>
            </statement>
            <next>
              <block type="text_print" id="59[6}c__:Tquu/Z@ZDoG">
                <value name="TEXT">
                  <shadow type="text" id=",gq~g]Y[+bVUxjE!BxPn">
                    <field name="TEXT">abc</field>
                  </shadow>
                  <block type="variables_get" id="Ov\`V7,,v8]@pXMNP9EJ:">
                    <field name="VAR" id="B\`@Q*C)!foy!~/E)8n%v">text</field>
                  </block>
                </value>
              </block>
            </next>
          </block>
        </statement>
        <value name="IF1">
          <block type="logic_compare" id="z?Iv/EG@J{@X+*FU:glc">
            <field name="OP">LTE</field>
            <value name="A">
              <block type="total_profit" id="M4n4xoKb|{$Z^lUX3(sv"></block>
            </value>
            <value name="B">
              <block type="math_single" id=";+6-$(!6}jxxD5GVamlo">
                <field name="OP">NEG</field>
                <value name="NUM">
                  <shadow type="math_number" id="%F;UF2,F0X8ptKFiJP{5">
                    <field name="NUM">9</field>
                  </shadow>
                  <block type="variables_get" id="ImmXc|o#DkVx/[DXdD4H">
                    <field name="VAR" id="1lyZu%^sRY)L\`ABj60;#">totalloss</field>
                  </block>
                </value>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO1">
          <block type="text_join" id="R^E}O]hFEqp4p5)uJ=wK">
            <field name="VARIABLE" id="}VK*]CMXvcC-5_Y\`dp6h">TEXT2</field>
            <statement name="STACK">
              <block type="text_statement" id="KvwyXyMYaH{qUZ{[/?|G">
                <value name="TEXT">
                  <shadow type="text" id="OAwSNl#Wgk;$O)G122Ol">
                    <field name="TEXT">STOP LOSS HIT — WE TRY AGAIN</field>
                  </shadow>
                </value>
              </block>
            </statement>
            <next>
              <block type="text_print" id="3(?$)G%MV+?N%HsuF!Jw">
                <value name="TEXT">
                  <shadow type="text" id=",gq~g]Y[+bVUxjE!BxPn2">
                    <field name="TEXT">abc</field>
                  </shadow>
                  <block type="variables_get" id="_Jlc0l}}1Kx%y@8xRLyh">
                    <field name="VAR" id="}VK*]CMXvcC-5_Y\`dp6h">TEXT2</field>
                  </block>
                </value>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="controls_if" id="+DnUleqx?MEa*^g.UvBP">
            <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
            <value name="IF0">
              <block type="contract_check_result" id="dNrpwAKB$j3(k-Sdaq_R">
                <field name="CHECK_RESULT">win</field>
              </block>
            </value>
            <statement name="DO0">
              <block type="notify" id="awc=:Mwoy{$DkH=nd$iK">
                <field name="NOTIFICATION_TYPE">info</field>
                <field name="NOTIFICATION_SOUND">earned-money</field>
                <value name="MESSAGE">
                  <shadow type="text" id="8jr!bt?#P%OjvqXe9BJl">
                    <field name="TEXT">abc</field>
                  </shadow>
                  <block type="contract_check_result" id="qxgD{P7K?N3*T|t|Ct,.">
                    <field name="CHECK_RESULT">win</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set" id="kETGk%thOUuOo|Iy)z!S">
                    <field name="VAR" id="nyrtB]!3ObqjLVHHuJ|5">stake</field>
                    <value name="VALUE">
                      <block type="variables_get" id="*n}G)oc{l*0=x(n/uKoe">
                        <field name="VAR" id="rKwHUdT+nn0j5KEZX:TY">initial stake </field>
                      </block>
                    </value>
                  </block>
                </next>
              </block>
            </statement>
            <statement name="ELSE">
              <block type="controls_if" id="=|sOy|5lw6oLSPtMvrw|">
                <mutation xmlns="http://www.w3.org/1999/xhtml" else="1"></mutation>
                <value name="IF0">
                  <block type="contract_check_result" id="vGhFMI+ipo5V}r%m^(lD">
                    <field name="CHECK_RESULT">loss</field>
                  </block>
                </value>
                <statement name="DO0">
                  <block type="notify" id="A6iz}@zc};3-WNN:$QZ0">
                    <field name="NOTIFICATION_TYPE">error</field>
                    <field name="NOTIFICATION_SOUND">error</field>
                    <value name="MESSAGE">
                      <shadow type="text" id="Kiaum.5wDuSp40s6fL:#">
                        <field name="TEXT">abc</field>
                      </shadow>
                      <block type="contract_check_result" id="GlK2HPBra4W$dS1(o[-Z">
                        <field name="CHECK_RESULT">loss</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="!A,O1{w?@7w8L5Cu(g0x">
                        <field name="VAR" id="nyrtB]!3ObqjLVHHuJ|5">stake</field>
                        <value name="VALUE">
                          <block type="math_arithmetic" id=")jeg),}qG_02p4{Zr?^W">
                            <field name="OP">MULTIPLY</field>
                            <value name="A">
                              <shadow type="math_number" id="pkI@|K4I2Cg#e6(R2cM#">
                                <field name="NUM">1</field>
                              </shadow>
                              <block type="variables_get" id="+UY2GVSPGii,u*:+G?gz">
                                <field name="VAR" id="nyrtB]!3ObqjLVHHuJ|5">stake</field>
                              </block>
                            </value>
                            <value name="B">
                              <shadow type="math_number" id="62K8.#%qO^1}[(8vZp#8">
                                <field name="NUM">1</field>
                              </shadow>
                              <block type="variables_get" id="vdLwMBJ;43TubIuIo">
                                <field name="VAR" id=",;WqBIU[7qCnbcVf.lZG">Martingale</field>
                              </block>
                            </value>
                          </block>
                        </value>
                      </block>
                    </next>
                  </block>
                </statement>
                <statement name="ELSE">
                  <block type="timeout" id="5oT-C79?%I4pVR{F)0$a">
                    <value name="SECONDS">
                      <block type="math_number" id="DT4w-X{fz;,SNtR7W5!{">
                        <field name="NUM">-0.00001</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="KzHetwK=!3C=9(7.xT(f">
                        <field name="VAR" id="nyrtB]!3ObqjLVHHuJ|5">stake</field>
                        <value name="VALUE">
                          <block type="variables_get" id=")v0un0~i27K-VQ$A-v">
                            <field name="VAR" id="rKwHUdT+nn0j5KEZX:TY">initial stake </field>
                          </block>
                        </value>
                      </block>
                    </next>
                  </block>
                </statement>
              </block>
            </statement>
            <next>
              <block type="trade_again" id="[(quINi:2%jdcT?Tzk@"></block>
            </next>
          </block>
        </statement>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="xox5)H9wAHlZI1m/]+_3" collapsed="true" deletable="false" x="0" y="886">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="timeout" id="vAjGqP]v+|dVaLJ{2}fM">
        <statement name="TIMEOUTSTACK">
          <block type="purchase" id="pO*:?hf0JXcnix_bHws8">
            <field name="PURCHASE_LIST">DIGITEVEN</field>
          </block>
        </statement>
        <value name="SECONDS">
          <block type="math_number" id="b#TUID[3[uSy]MK3qp,U">
            <field name="NUM">-0.00001</field>
          </block>
        </value>
      </block>
    </statement>
  </block>
</xml>`;

function momentumRun(prices: number[]): { dir: 1 | -1 | 0; run: number } {
    if (prices.length < 3) return { dir: 0, run: 0 };
    let dir: 1 | -1 | 0 = 0; let run = 0;
    for (let i = prices.length - 1; i > 0; i--) {
        const step = prices[i] - prices[i - 1];
        const d = step > 0 ? 1 : step < 0 ? -1 : 0;
        if (d === 0) break;
        if (dir === 0) { dir = d; run = 1; }
        else if (d === dir) run++;
        else break;
    }
    return { dir, run };
}

interface DigitFreq { symbol: string; label: string; group: string; pcts: number[]; ticks: number[]; prices: number[]; total: number; }
interface Signal { symbol: string; label: string; group: string; type: ContractType; barrier?: number; confidence: number; ticks: number; note: string; autoDigit?: number; }

/**
 * Rise/Fall and Matches/Differs must only ever use 1 or 2 ticks (never 3+).
 * Over/Under/Even/Odd keep the wider 1-3 tick range since they aren't
 * affected by the normalization request.
 */
function getTickCount(confidence: number, is1s: boolean, capAt2 = false): number {
    if (capAt2) return confidence >= 75 ? 1 : 2;
    return confidence >= 75 ? 1 : is1s ? 2 : 3;
}

// Entry thresholds below follow the "Delayed Digit Exhaustion" MATCHES strategy
// and "Double Repetition Reversal" DIFFERS strategy from the attached professional
// Deriv strategy PDFs: MATCHES waits for a digit absent 15-22 ticks (V25) /
// 12-18 ticks (V10) before entry; DIFFERS enters after 2 consecutive repeats.
function evaluateAutoMatches(freq: DigitFreq): Signal | null {
    const { pcts, ticks, label, symbol, group } = freq;
    const is1s = symbol.includes('HZ');
    if (freq.total < 50) return null;
    let bestMissing: number | null = null; let longestAbsence = 0;
    for (let d = 0; d <= 9; d++) {
        let absent = 0;
        for (let i = ticks.length - 1; i >= 0; i--) { if (ticks[i] === d) break; absent++; }
        if (absent >= 15 && absent > longestAbsence) { longestAbsence = absent; bestMissing = d; }
    }
    if (bestMissing !== null) {
        const conf = clamp(60 + (longestAbsence - 15) * 2, 60, 90);
        return { symbol, label, group, type: 'matches', barrier: bestMissing, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: bestMissing, note: `Digit ${bestMissing} absent ${longestAbsence} ticks.` };
    }
    if (ticks.length >= 2 && ticks.slice(-2)[0] === ticks.slice(-2)[1]) {
        const d = ticks[ticks.length - 1];
        const conf = clamp(62 + pcts[d] * 1.5, 62, 88);
        return { symbol, label, group, type: 'matches', barrier: d, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: d, note: `Double echo ${d}${d}.` };
    }
    let bestD = -1; let bestPct = 0;
    for (let d = 0; d <= 9; d++) { if (pcts[d] > bestPct) { bestPct = pcts[d]; bestD = d; } }
    if (bestPct >= 13.5 && bestD >= 0) {
        const conf = clamp(55 + (bestPct - 13.5) * 6, 55, 92);
        return { symbol, label, group, type: 'matches', barrier: bestD, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: bestD, note: `Digit ${bestD} at ${bestPct.toFixed(1)}%.` };
    }
    return null;
}

function evaluateAutoDiffers(freq: DigitFreq): Signal | null {
    const { pcts, ticks, label, symbol, group } = freq;
    const is1s = symbol.includes('HZ');
    if (freq.total < 30) return null;
    if (ticks.length >= 3) {
        const last3 = ticks.slice(-3);
        if (last3[0] === last3[1] && last3[1] === last3[2]) {
            const d = last3[0]; const conf = 90;
            return { symbol, label, group, type: 'differs', barrier: d, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: d, note: `Triple ${d}${d}${d} — exhaustion.` };
        }
    }
    if (ticks.length >= 2 && ticks.slice(-2)[0] === ticks.slice(-2)[1]) {
        const d = ticks[ticks.length - 1];
        const conf = clamp(82 + (10 - pcts[d]) * 1.5, 82, 96);
        return { symbol, label, group, type: 'differs', barrier: d, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: d, note: `Double ${d}${d} — differs high.` };
    }
    const last10 = ticks.slice(-10); const freqMap = new Array(10).fill(0);
    last10.forEach(t => freqMap[t]++);
    let domDigit = -1; let domCount = 0;
    freqMap.forEach((c, d) => { if (c > domCount) { domCount = c; domDigit = d; } });
    if (domCount >= 4 && domDigit >= 0) {
        const conf = clamp(78 + (domCount - 4) * 3, 78, 94);
        return { symbol, label, group, type: 'differs', barrier: domDigit, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: domDigit, note: `Digit ${domDigit} dominant ${domCount}/10.` };
    }
    let minD = -1; let minPct = 100;
    for (let d = 0; d <= 9; d++) { if (pcts[d] < minPct) { minPct = pcts[d]; minD = d; } }
    if (minPct <= 7.5 && minD >= 0) {
        const conf = clamp(80 + (7.5 - minPct) * 4, 80, 96);
        return { symbol, label, group, type: 'differs', barrier: minD, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: minD, note: `Digit ${minD} at ${minPct.toFixed(1)}%.` };
    }
    return null;
}

function evaluate(freq: DigitFreq, type: ContractType, predictionDigit: number): Signal | null {
    const { pcts, label, symbol, group } = freq;
    const is1s = symbol.includes('HZ');
    if (freq.total < 30) return null;
    if (type === 'matches') return evaluateAutoMatches(freq);
    if (type === 'differs') return evaluateAutoDiffers(freq);
    if (type === 'over') {
        const N = predictionDigit;
        const losing = Array.from({ length: N + 1 }, (_, i) => i);
        if (!losing.every(d => pcts[d] < 10.0)) return null;
        const shield = N + 1; const shieldPct = shield <= 9 ? pcts[shield] : 0;
        if (shieldPct < 10.2) return null;
        const conf = clamp(70 + (shieldPct - 10.2) * 14 + (10 - Math.max(...losing.map(d => pcts[d]))) * 4, 70, 99);
        return { symbol, label, group, type, barrier: N, confidence: conf, ticks: getTickCount(conf, is1s), note: `Digits 0-${N} all <10%. Shield ${shield} at ${shieldPct.toFixed(1)}%.` };
    }
    if (type === 'under') {
        const N = predictionDigit;
        const losing = Array.from({ length: 10 - N }, (_, i) => N + i);
        if (!losing.every(d => pcts[d] < 10.0)) return null;
        const shield = N - 1; const shieldPct = shield >= 0 ? pcts[shield] : 0;
        if (shieldPct < 10.2) return null;
        const conf = clamp(70 + (shieldPct - 10.2) * 14 + (10 - Math.max(...losing.map(d => pcts[d]))) * 4, 70, 99);
        return { symbol, label, group, type, barrier: N, confidence: conf, ticks: getTickCount(conf, is1s), note: `Digits ${N}-9 all <10%. Shield ${shield} at ${shieldPct.toFixed(1)}%.` };
    }
    if (type === 'rise' || type === 'fall') {
        const { dir, run } = momentumRun(freq.prices);
        if (run < 3) return null;
        if ((type === 'rise' && dir !== 1) || (type === 'fall' && dir !== -1)) return null;
        if (Math.max(...pcts) > 14) return null;
        const QUALITY: Record<string, number> = { '1HZ10V': 6, '1HZ25V': 6, '1HZ50V': 4, R_10: 4, R_25: 3, JD10: 5 };
        const conf = clamp(58 + (run - 3) * 7 + (QUALITY[symbol] ?? 0) * 3, 58, 92);
        return { symbol, label, group, type, confidence: conf, ticks: getTickCount(conf, is1s, true), note: `${run} consecutive ${type === 'rise' ? 'up' : 'down'} ticks.` };
    }
    const evenPct = [0, 2, 4, 6, 8].reduce((s, d) => s + pcts[d], 0);
    if (type === 'even') {
        const above = [0, 2, 4, 6, 8].filter(d => pcts[d] >= 10.3).length;
        if (above < 3 || evenPct < 52) return null;
        const conf = clamp((evenPct - 50) * 4 + 62, 62, 95);
        return { symbol, label, group, type, confidence: conf, ticks: getTickCount(conf, is1s), note: `Even share ${evenPct.toFixed(1)}%.` };
    }
    if (type === 'odd') {
        const oddPct = 100 - evenPct;
        const above = [1, 3, 5, 7, 9].filter(d => pcts[d] >= 10.3).length;
        if (above < 3 || evenPct >= 48) return null;
        const conf = clamp((50 - evenPct) * 4 + 62, 62, 95);
        return { symbol, label, group, type, confidence: conf, ticks: getTickCount(conf, is1s), note: `Odd share ${oddPct.toFixed(1)}%.` };
    }
    return null;
}

/** Instant-fire default — fires immediately with no scan required. */
const DEFAULT_SIGNAL: Signal = {
    symbol: '1HZ25V', label: 'Volatility 25 (1s)', group: 'Volatility 1s',
    type: 'even', confidence: 70, ticks: 1, note: 'Default instant-fire signal',
};

const AIAssistant: React.FC = () => {
    const { dashboard, load_modal, run_panel } = useStore() as any;
    const { currency: accountCurrency } = useDerivTrading();
    // useDerivTrade rides the app's existing authenticated connection — same login, no separate token
    const derivTrade = useDerivTrade();
    const derivTradeRef = useRef(derivTrade);
    useEffect(() => { derivTradeRef.current = derivTrade; }, [derivTrade]);

    const [isOpen, setIsOpen]         = useState(false);
    const [isPulsing, setIsPulsing]   = useState(true);
    const [scanning, setScanning]     = useState(false);
    const [scanProgress, setScanProgress] = useState('');
    const [scannedCount, setScannedCount] = useState(0);

    const [contractType, setContractType] = useState<ContractType>('over');
    const [predictionDigit, setPredictionDigit] = useState(4);
    const [stake, setStake]           = useState(0.5);
    const [martingale, setMartingale] = useState(2.2);
    const [takeProfit, setTakeProfit] = useState(10);
    const [stopLoss, setStopLoss]     = useState(5);

    const [best, setBest]             = useState<Signal | null>(null);
    const [allSignals, setAllSignals] = useState<Signal[]>([]);
    const [botRunning, setBotRunning] = useState(false);
    const [sessionProfit, setSessionProfit] = useState(0);
    const [tradeCount, setTradeCount] = useState(0);
    const [botLog, setBotLog]         = useState<string[]>([]);
    const [autoRestart, setAutoRestart] = useState(false);
    const autoRestartRef = useRef(false);
    useEffect(() => { autoRestartRef.current = autoRestart; }, [autoRestart]);

    // AI-local speed mode (independent of global FloatingRunButton speed)
    const [aiMode, setAiMode] = useState<'normal' | 'crazy' | 'turbo'>('normal');
    const aiModeRef = useRef<'normal' | 'crazy' | 'turbo'>('normal');
    useEffect(() => { aiModeRef.current = aiMode; }, [aiMode]);

    // Pause / resume
    const [botPaused, setBotPaused] = useState(false);
    const pausedRef = useRef(false);
    useEffect(() => { pausedRef.current = botPaused; }, [botPaused]);

    // Live digit match — when ON and liveDigit === barrier, fires 1 trade automatically
    const [liveDigitTrigger, setLiveDigitTrigger] = useState(false);

    // Track consecutive profitable wins (for Fire Now = 3 wins)
    const profitWinsRef = useRef(0);
    const maxWinsRef = useRef<number | null>(null);

    // T007: antenna on/off toggle + live last-digit readout for the currently tracked market
    const [antennaOn, setAntennaOn] = useState(true);
    const [liveDigit, setLiveDigit] = useState<number | null>(null);
    const antennaWsRef = useRef<WebSocket | null>(null);

    const wsRefs    = useRef<WebSocket[]>([]);
    const freqRef   = useRef<Map<string, DigitFreq>>(new Map());
    const scanDoneRef = useRef(false);
    const runRef    = useRef(false);
    const stakeRef  = useRef(stake);
    const tradeCountRef = useRef(0);
    const sessionProfitRef = useRef(0);

    useEffect(() => { stakeRef.current = stake; }, [stake]);

    // Live-digit auto-trigger: fires a single trade when the live digit matches the barrier
    useEffect(() => {
        if (!liveDigitTrigger || botRunning || !best || liveDigit === null) return;
        const barrier = best.autoDigit !== undefined ? best.autoDigit : best.barrier;
        if (barrier !== undefined && liveDigit === barrier) {
            addLog(`⚡ Live digit ${liveDigit} matched barrier ${barrier} — auto-firing 1 trade`);
            loadAndRunRef.current?.(best, 1);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveDigit]);

    // Antenna: live last-digit stream for whichever symbol the AI is currently tracking (best signal, or first scan target)
    useEffect(() => {
        if (antennaWsRef.current) { try { antennaWsRef.current.close(); } catch { } antennaWsRef.current = null; }
        setLiveDigit(null);
        if (!antennaOn) return;
        const symbol = best?.symbol ?? SCAN_SYMBOLS[0]?.symbol;
        if (!symbol) return;
        const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        antennaWsRef.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        ws.onmessage = e => {
            const d = JSON.parse(e.data);
            const quote = d.tick?.quote;
            if (typeof quote === 'number') {
                const s = quote.toFixed(quote < 10 ? 4 : 2).replace('.', '');
                setLiveDigit(parseInt(s[s.length - 1], 10));
            }
        };
        return () => { try { ws.close(); } catch { } };
    }, [antennaOn, best?.symbol]);

    // AI always operates in USD — no display-currency conversion here.
    const fmtProfit = (usd: number) => `${usd >= 0 ? '+' : ''}${usd.toFixed(2)} USD`;
    const fmtVal    = (usd: number) => `${usd.toFixed(2)} USD`;

    /* ─────────── Draggable trigger button ─────────── */
    const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
    const dragStateRef = useRef<{ startX: number; startY: number; origX: number; origY: number; dragging: boolean } | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    const onDragPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const btn = triggerRef.current;
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        dragStateRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: dragPos?.x ?? rect.left,
            origY: dragPos?.y ?? rect.top,
            dragging: false,
        };
        (e.target as HTMLButtonElement).setPointerCapture?.(e.pointerId);
    }, [dragPos]);

    const onDragPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const st = dragStateRef.current;
        if (!st) return;
        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;
        if (!st.dragging && Math.hypot(dx, dy) < 4) return;
        st.dragging = true;
        const btn = triggerRef.current;
        const w = btn?.offsetWidth ?? 60;
        const h = btn?.offsetHeight ?? 60;
        const x = Math.max(4, Math.min(window.innerWidth - w - 4, st.origX + dx));
        const y = Math.max(4, Math.min(window.innerHeight - h - 4, st.origY + dy));
        setDragPos({ x, y });
    }, []);

    const onDragPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const st = dragStateRef.current;
        (e.target as HTMLButtonElement).releasePointerCapture?.(e.pointerId);
        dragStateRef.current = null;
        if (st?.dragging) {
            // swallow the click that follows a drag so it doesn't reopen/close the modal
            const btn = triggerRef.current;
            if (btn) {
                const suppressClick = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
                btn.addEventListener('click', suppressClick, { capture: true, once: true });
            }
        }
    }, []);

    const addLog = useCallback((msg: string) => {
        const ts = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setBotLog(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 80));
    }, []);

    /* ─────────── Market scanner ─────────── */
    const stopScan = useCallback(() => {
        wsRefs.current.forEach(ws => { try { ws.close(); } catch { } });
        wsRefs.current = [];
        setScanning(false);
        setScanProgress('');
        scanDoneRef.current = false;
    }, []);

    const recompute = useCallback(() => {
        const signals: Signal[] = [];
        let ready = 0;
        freqRef.current.forEach(freq => {
            if (freq.total > 30) { ready++; const sig = evaluate(freq, contractType, predictionDigit); if (sig) signals.push(sig); }
        });
        signals.sort((a, b) => b.confidence - a.confidence);
        setScannedCount(ready);
        setAllSignals(signals);
        setBest(signals[0] ?? null);
    }, [contractType, predictionDigit]);

    const startScan = useCallback(() => {
        stopScan();
        freqRef.current.clear();
        setBest(null); setAllSignals([]); setScannedCount(0);
        setScanning(true); scanDoneRef.current = false;
        SCAN_SYMBOLS.forEach(({ symbol, label, group }) => {
            freqRef.current.set(symbol, { symbol, label, group, pcts: new Array(10).fill(10), ticks: [], prices: [], total: 0 });
        });
        let idx = 0;
        const scanNext = () => {
            if (idx >= SCAN_SYMBOLS.length || scanDoneRef.current) { setScanning(false); setScanProgress(`Scan complete — ${SCAN_SYMBOLS.length} markets`); return; }
            const { symbol, label } = SCAN_SYMBOLS[idx];
            setScanProgress(`Scanning ${label}... (${idx + 1}/${SCAN_SYMBOLS.length})`);
            const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
            wsRefs.current.push(ws);
            let received = false;
            ws.onopen = () => ws.send(JSON.stringify({ ticks_history: symbol, count: 500, end: 'latest', style: 'ticks' }));
            ws.onmessage = e => {
                if (received) return;
                const d = JSON.parse(e.data);
                const freq = freqRef.current.get(symbol);
                if (!freq) return;
                if (d.history?.prices) {
                    received = true;
                    const prices = d.history.prices as number[];
                    freq.prices = prices.slice(-500);
                    freq.ticks = prices.map((p: number) => { const s = p.toFixed(2).replace('.', ''); return parseInt(s[s.length - 1], 10); });
                    freq.total = freq.ticks.length;
                    const counts = new Array(10).fill(0);
                    freq.ticks.forEach(t => counts[t]++);
                    freq.pcts = counts.map(c => freq.total > 0 ? (c / freq.total) * 100 : 10);
                    recompute();
                    try { ws.close(); } catch { }
                    idx++; setTimeout(scanNext, 80);
                }
                if (d.error) { received = true; try { ws.close(); } catch { } idx++; setTimeout(scanNext, 80); }
            };
            ws.onerror = () => { if (!received) { received = true; idx++; setTimeout(scanNext, 80); } };
            setTimeout(() => { if (!received) { received = true; try { ws.close(); } catch { } idx++; scanNext(); } }, 5000);
        };
        scanNext();
    }, [recompute, stopScan]);

    useEffect(() => { if (!scanning) recompute(); }, [contractType, predictionDigit]);
    useEffect(() => () => { stopScan(); scanDoneRef.current = true; runRef.current = false; }, [stopScan]);

    /* ─────────── Direct-fire bot loop ─────────── */
    const stopBot = useCallback(() => {
        runRef.current = false;
        setBotRunning(false);
        addLog('⏹ Bot stopped by user.');
    }, [addLog]);

    // Keep a stable ref so auto-restart can call loadAndRun without stale closure
    const loadAndRunRef = useRef<(sig?: Signal) => void>(() => {});
    // "Fire Now" caps the session at exactly 3 trades then auto-stops, regardless
    // of TP/SL. "Load & Run Bot" leaves this unset and runs until TP/SL/user-stop.
    const maxRunsRef = useRef<number | null>(null);

    /** Try silently loading the killer XML into the Blockly workspace (display only, does NOT start the engine). */
    const tryLoadXmlToWorkspace = useCallback((xmlString: string) => {
        try {
            const B = (window as any).Blockly;
            if (!B) return;
            const ws = B.getMainWorkspace?.() ?? B.mainWorkspace;
            if (!ws) return;
            const dom = B.utils?.xml?.textToDom
                ? B.utils.xml.textToDom(xmlString)
                : B.Xml?.textToDom?.(xmlString);
            if (!dom) return;
            ws.clear();
            B.Xml.domToWorkspace(dom, ws);
        } catch { /* workspace not ready — silently skip */ }
    }, []);

    const loadAndRun = useCallback(async (sig?: Signal, maxWins?: number) => {
        // Use best scanned signal, or instant-fire with the default if none available
        const signal = sig ?? best ?? DEFAULT_SIGNAL;
        if (botRunning) { stopBot(); return; }
        maxRunsRef.current = maxWins != null ? maxWins * 10 : null; // safety cap on trade count
        maxWinsRef.current = maxWins ?? null;

        // ─── Guard: refuse to fire without a live, authenticated trading connection ───
        // useDerivTrade now rides the SAME connection the user is already logged in
        // with (no separate token/login) — this just waits out the brief moment
        // right after app load where that connection is still authorizing.
        if (!derivTradeRef.current.authorized) {
            setIsOpen(true);
            addLog('⏳ Waiting for your account connection to be ready...');
            const ready = await new Promise<boolean>(resolve => {
                const start = Date.now();
                const poll = () => {
                    if (derivTradeRef.current.authorized) return resolve(true);
                    if (Date.now() - start > 8000) return resolve(false);
                    setTimeout(poll, 250);
                };
                poll();
            });
            if (!ready) {
                addLog('🛑 Not connected to your Deriv account yet. Please make sure you are logged in.');
                return;
            }
            addLog('✅ Connected — ready to trade.');
        }

        const barrier = signal.autoDigit !== undefined ? signal.autoDigit : (signal.barrier ?? predictionDigit);
        const apiContractType = CONTRACT_TYPE_MAP[signal.type];

        // Reset session state
        sessionProfitRef.current = 0;
        tradeCountRef.current = 0;
        profitWinsRef.current = 0;
        stakeRef.current = stake;
        setSessionProfit(0);
        setTradeCount(0);
        setBotLog([]);
        setBotRunning(true);
        runRef.current = true;
        // DO NOT close the panel — keep it open so the user can see logs and stop the bot

        // Load the XML strategy to Bot Builder for display (trading still runs via direct-fire loop)
        try {
            const { buildKillerXml: bkx } = await import('@/utils/killer-bot');
            const xmlStr = bkx(KILLER_XML_TEMPLATE, {
                symbol: signal.symbol,
                contract: signal.type,
                barrier: signal.autoDigit !== undefined ? signal.autoDigit : (signal.barrier ?? predictionDigit),
                ticks: signal.ticks,
                stake,
                martingale,
                takeProfit,
                stopLoss,
            });
            tryLoadXmlToWorkspace(xmlStr);
        } catch { /* ignore build/load errors */ }

        // NOTE: We do NOT call run_panel?.setIsRunning?.(true) here because that
        // activates the Blockly bot engine which enforces its own buy limits and
        // would conflict with the direct-fire loop below. The AI assistant runs
        // its own independent trading loop without any buy-count restrictions.

        addLog(`🚀 Starting ${signal.type.toUpperCase()}${barrier !== undefined ? barrier : ''} on ${signal.label} | Stake:${fmtVal(stake)} | Mart:${martingale}x | TP:${fmtVal(takeProfit)} | SL:${fmtVal(stopLoss)}`);

        // ─── Direct-fire loop via useDerivTrade (own authenticated WS) ───
        // Speed modes:
        //   Normal  — buy + await settlement (full P/L capture, sequential)
        //   Crazy   — same but no micro-delay between trades (slightly faster)
        //   Turbo   — fire-and-forget: settlement tracked in background, loop fires immediately
        (async () => {
            const tradeParams = {
                symbol: signal.symbol,
                contract_type: apiContractType as any,
                duration: signal.ticks,
                duration_unit: 't' as any,
                stake: 0,               // filled each iteration
                ...(NEEDS_BARRIER.has(signal.type) ? { barrier } : {}),
            };

            /** Buys one contract and resolves with the settlement profit. */
            const buyAndSettle = (curStake: number): Promise<number> =>
                new Promise(resolve => {
                    const bail = setTimeout(() => { addLog('⏱ Timeout waiting for settlement'); resolve(0); }, 15000);
                    derivTradeRef.current.buyContract(
                        { ...tradeParams, stake: curStake },
                        settled => { clearTimeout(bail); resolve(settled.profit ?? 0); }
                    ).then(result => {
                        if (!result?.contract_id) { clearTimeout(bail); resolve(0); }
                    }).catch(err => {
                        clearTimeout(bail);
                        const msg = err?.message || err?.error?.message || 'Buy failed';
                        addLog(`⚠️ ${msg}`);
                        resolve(0);
                    });
                });

            const applyResult = (profit: number) => {
                tradeCountRef.current++;
                sessionProfitRef.current += profit;
                const sp = sessionProfitRef.current;
                const tc = tradeCountRef.current;
                setTradeCount(tc);
                setSessionProfit(sp);
                const won = profit > 0;
                addLog(`${won ? '✅' : '❌'} #${tc} ${won ? 'WIN' : 'LOSS'} ${fmtProfit(profit)} | Session: ${fmtProfit(sp)} | Stake: ${fmtVal(stakeRef.current)}`);
                // Martingale: all in USD
                stakeRef.current = won ? stake : Math.max(0.35, +(stakeRef.current * martingale).toFixed(2));

                // Fire Now: stop after N total trades (runs), regardless of win/loss
                if (maxWinsRef.current != null && tc >= maxWinsRef.current) {
                    addLog(`🏁 Fire Now: ${tc} run${tc > 1 ? 's' : ''} completed! Session P/L: ${fmtProfit(sp)}`);
                    runRef.current = false;
                    setBotRunning(false);
                    return;
                }

                if (sp >= takeProfit) {
                    addLog(`🏆 TAKE PROFIT hit! Session P/L: ${fmtProfit(sp)}`);
                    runRef.current = false;
                    setBotRunning(false);
                    if (autoRestartRef.current) {
                        addLog('🔄 Auto-restarting in 2s...');
                        setTimeout(() => { if (autoRestartRef.current) loadAndRunRef.current?.(); }, 2000);
                    }
                }
                if (sp <= -stopLoss) {
                    addLog(`🛑 STOP LOSS hit! Session P/L: ${fmtProfit(sp)}`);
                    runRef.current = false;
                    setBotRunning(false);
                    if (autoRestartRef.current) {
                        addLog('🔄 Auto-restarting in 2s...');
                        setTimeout(() => { if (autoRestartRef.current) loadAndRunRef.current?.(); }, 2000);
                    }
                }
            };

            // Speed mode controls how many purchases fire within a single tick:
            // Normal = 1 purchase per tick (sequential, await settlement)
            // Crazy  = 5 parallel purchases fired together in under 1 second, on 1 tick
            // Turbo  = 10 parallel purchases fired together in under 1 second, on 1 tick
            const PURCHASES_PER_TICK = { normal: 1, crazy: 5, turbo: 10 } as const;

            const fireAndForget = (curStake: number) => {
                derivTradeRef.current.buyContract(
                    { ...tradeParams, stake: curStake },
                    // Only apply settlement if the bot is still running — once stopped
                    // (e.g. Fire Now cap hit) in-flight contracts should not count further.
                    settled => { if (runRef.current) applyResult(settled.profit ?? 0); }
                ).catch(err => {
                    const msg = err?.message || err?.error?.message || 'Buy error';
                    addLog(`⚠️ ${msg}`);
                });
            };

            while (runRef.current) {
                // Pause: spin-wait until resumed
                if (pausedRef.current) {
                    await new Promise(r => setTimeout(r, 120));
                    continue;
                }
                const curStake = stakeRef.current;
                // Read AI-local speed mode (not the global FloatingRunButton speed)
                const speed = aiModeRef.current;
                try {
                    if (speed === 'turbo' || speed === 'crazy') {
                        // Fire all purchases instantly, then yield just enough to
                        // keep the event loop responsive (no artificial 900ms stall).
                        const count = PURCHASES_PER_TICK[speed];
                        for (let _i = 0; _i < count; _i++) fireAndForget(curStake);
                        await Promise.resolve(); // zero-delay yield — no tick-throttle
                    } else {
                        // Normal: sequential — one contract per tick, full settlement
                        const profit = await buyAndSettle(curStake);
                        if (!runRef.current) break;
                        applyResult(profit);
                    }
                } catch (err: any) {
                    const msg = err?.error?.message || err?.message || 'Unknown error';
                    addLog(`⚠️ ${msg}`);
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            runRef.current = false;
            setBotRunning(false);
            setBotPaused(false);
            pausedRef.current = false;
        })();
    }, [best, predictionDigit, stake, martingale, takeProfit, stopLoss, botRunning, addLog, stopBot, tryLoadXmlToWorkspace]);

    // Keep ref in sync so auto-restart can call without stale closure
    useEffect(() => { loadAndRunRef.current = loadAndRun; }, [loadAndRun]);

    const isMatchesDiffers = contractType === 'matches' || contractType === 'differs';
    const needsDigit       = contractType === 'over' || contractType === 'under';
    const confClass        = best ? (best.confidence >= 80 ? 'high' : best.confidence >= 70 ? 'medium' : 'low') : '';
    const digitOptions     = contractType === 'over' ? [0,1,2,3,4,5,6,7] : contractType === 'under' ? [1,2,3,4,5,6,7,8,9] : [0,1,2,3,4,5,6,7,8,9];

    return (
        <>
            {/* Status pill */}
            {botRunning && (
                <div className='ai-assistant__fire-pill' onClick={stopBot} title='Click to stop the bot'>
                    🤖 RUNNING #{tradeCount} | {fmtProfit(sessionProfit)} &nbsp;·&nbsp; <span style={{ color: '#ff6b6b' }}>⏹ STOP</span>
                </div>
            )}

            <button
                ref={triggerRef}
                className={`ai-assistant__trigger ${isPulsing ? 'ai-assistant__trigger--pulse' : ''} ${botRunning ? 'ai-assistant__trigger--running' : ''}`}
                style={dragPos ? { left: dragPos.x, top: dragPos.y, right: 'auto', bottom: 'auto' } : undefined}
                onClick={() => { setIsOpen(true); setIsPulsing(false); }}
                onPointerDown={onDragPointerDown}
                onPointerMove={onDragPointerMove}
                onPointerUp={onDragPointerUp}
                onPointerCancel={onDragPointerUp}
                title='AI Market Scanner (drag to move)'
            >
                <div className='ai-assistant__sphere'>
                    <span className='ai-assistant__clock-hand' />
                    <span>{botRunning ? '⏸' : 'AI'}</span>
                </div>
            </button>

            {isOpen && (
                <div className='ai-assistant__overlay' onClick={() => setIsOpen(false)}>
                    <div className='ai-assistant__modal' onClick={e => e.stopPropagation()}>
                        <div className='ai-assistant__modal-header'>
                            <div
                                className='ai-assistant__live-digit'
                                title={antennaOn ? 'Live last digit of tracked market' : 'Antenna is off'}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6, opacity: antennaOn ? 1 : 0.35 }}
                            >
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8aa0b8' }}>DIGIT</span>
                                <span style={{
                                    minWidth: 22, height: 22, borderRadius: '50%', display: 'inline-flex',
                                    alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem',
                                    background: antennaOn && liveDigit !== null ? '#00ff9622' : 'rgba(255,255,255,0.06)',
                                    color: antennaOn && liveDigit !== null ? '#00ff96' : '#8aa0b8', border: '1px solid rgba(255,255,255,0.12)',
                                }}>
                                    {antennaOn && liveDigit !== null ? liveDigit : '–'}
                                </span>
                            </div>
                            <div className={`ai-assistant__status-dot ${scanning ? 'live' : botRunning ? 'running' : ''}`} />
                            <h3>AI Market Scanner</h3>
                            {scanning && <span className='ai-assistant__live'>SCANNING {scannedCount}/{SCAN_SYMBOLS.length}</span>}
                            {botRunning && <span className='ai-assistant__live' style={{ color: '#00ff96' }}>🤖 #{tradeCount} | {fmtProfit(sessionProfit)}</span>}
                            <button
                                className='ai-assistant__antenna-toggle'
                                onClick={() => setAntennaOn(v => !v)}
                                title={antennaOn ? 'Turn antenna off' : 'Turn antenna on'}
                                style={{
                                    marginLeft: 'auto', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: '0.85rem',
                                    cursor: 'pointer', background: antennaOn ? '#00ff9622' : 'rgba(255,255,255,0.08)',
                                    color: antennaOn ? '#00ff96' : '#8aa0b8',
                                }}
                            >
                                📡 {antennaOn ? 'ON' : 'OFF'}
                            </button>
                            <button className='ai-assistant__close' onClick={() => setIsOpen(false)}>✕</button>
                        </div>

                        {/* Trading connection status — rides the same login as the rest of the app */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '0.7rem', fontWeight: 700 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: derivTrade.authorized ? '#00ff96' : derivTrade.connected ? '#f97316' : '#ff4d4f', display: 'inline-block' }} />
                            <span style={{ color: derivTrade.authorized ? '#00ff96' : derivTrade.connected ? '#f97316' : '#ff4d4f' }}>
                                {derivTrade.authorized ? 'ACCOUNT CONNECTED' : derivTrade.connected ? 'AUTHORIZING...' : 'CONNECTING...'}
                            </span>
                        </div>

                        <div className='ai-assistant__body'>
                            {scanning && scanProgress && (
                                <div className='ai-assistant__scan-progress'>
                                    <div className='ai-assistant__scan-bar'>
                                        <div className='ai-assistant__scan-fill' style={{ width: `${(scannedCount / SCAN_SYMBOLS.length) * 100}%` }} />
                                    </div>
                                    <span>{scanProgress}</span>
                                </div>
                            )}

                            {/* Bot live log */}
                            {botRunning && botLog.length > 0 && (
                                <div className='ai-assistant__bot-log'>
                                    {botLog.slice(0, 5).map((l, i) => <div key={i} className='ai-assistant__bot-log-entry'>{l}</div>)}
                                </div>
                            )}

                            {best ? (
                                <div className={`ai-assistant__signal ai-assistant__signal--${confClass}`}>
                                    <div className='ai-assistant__signal-head'>
                                        <span className='ai-assistant__signal-found'>✔ Best signal</span>
                                        <span className='ai-assistant__signal-conf'>{best.confidence.toFixed(1)}%</span>
                                    </div>
                                    <div className='ai-assistant__signal-market'>
                                        {best.label}<span className='ai-assistant__signal-group'> [{best.group}]</span>
                                    </div>
                                    <div className='ai-assistant__signal-type'>
                                        {best.type.toUpperCase()}{(best.autoDigit !== undefined ? best.autoDigit : best.barrier) !== undefined ? ` ${best.autoDigit !== undefined ? best.autoDigit : best.barrier}` : ''}
                                        {' '}· {best.ticks} tick{best.ticks > 1 ? 's' : ''}
                                        {isMatchesDiffers && best.autoDigit !== undefined && <span className='ai-assistant__auto-tag'>🤖 auto</span>}
                                    </div>
                                    <div className='ai-assistant__signal-note'>{best.note}</div>
                                    {allSignals.length > 1 && (
                                        <div className='ai-assistant__alt-signals'>
                                            <span>Alt: </span>
                                            {allSignals.slice(1, 4).map((s, i) => (
                                                <span key={i} className='ai-assistant__alt' onClick={() => setBest(s)}>
                                                    {s.label.replace(' Index', '')} {s.type.toUpperCase()}{s.autoDigit !== undefined ? s.autoDigit : s.barrier !== undefined ? s.barrier : ''} ({s.confidence.toFixed(0)}%)
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : !scanning ? (
                                <div className='ai-assistant__searching'>
                                    <span>{scannedCount > 0 ? 'No high-confidence setup. Try a different type or scan again.' : 'Press SCAN to analyse all markets.'}</span>
                                </div>
                            ) : (
                                <div className='ai-assistant__searching'>
                                    <div className='ai-assistant__pulse' />
                                    <span>Scanning markets...</span>
                                </div>
                            )}

                            {/* Trade type */}
                            <div className='ai-assistant__field'>
                                <label>TRADE TYPE</label>
                                <div className='ai-assistant__trade-types'>
                                    {(['over', 'under', 'even', 'odd', 'rise', 'fall', 'matches', 'differs'] as ContractType[]).map(t => (
                                        <button key={t} className={`ai-assistant__type-btn ${contractType === t ? 'active' : ''}`} onClick={() => setContractType(t)}>
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {needsDigit && (
                                <div className='ai-assistant__field'>
                                    <label>BARRIER DIGIT</label>
                                    <select value={predictionDigit} onChange={e => setPredictionDigit(Number(e.target.value))}>
                                        {digitOptions.map(d => <option key={d} value={d}>{contractType.charAt(0).toUpperCase() + contractType.slice(1)} {d}</option>)}
                                    </select>
                                </div>
                            )}
                            {isMatchesDiffers && <div className='ai-assistant__auto-note'>🤖 AI auto-selects best digit for {contractType}</div>}

                            {/* Stake + Martingale */}
                            <div className='ai-assistant__field-row'>
                                <div className='ai-assistant__field'>
                                    <label>STAKE (USD)</label>
                                    <input type='number' value={stake} min={0.35} step={0.1} onChange={e => { setStake(Number(e.target.value)); stakeRef.current = Number(e.target.value); }} />
                                </div>
                                <div className='ai-assistant__field'>
                                    <label>MARTINGALE ×</label>
                                    <input type='number' value={martingale} min={1} step={0.1} onChange={e => setMartingale(Number(e.target.value))} />
                                </div>
                            </div>

                            {/* TP + SL */}
                            <div className='ai-assistant__field-row'>
                                <div className='ai-assistant__field'>
                                    <label>TAKE PROFIT (USD)</label>
                                    <input type='number' value={takeProfit} min={0.5} step={0.5} onChange={e => setTakeProfit(Number(e.target.value))} />
                                </div>
                                <div className='ai-assistant__field'>
                                    <label>STOP LOSS (USD)</label>
                                    <input type='number' value={stopLoss} min={0.5} step={0.5} onChange={e => setStopLoss(Number(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        {/* AI Speed Mode selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.04)' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', marginRight: 4 }}>AI SPEED</span>
                            {(['normal', 'crazy', 'turbo'] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setAiMode(m)}
                                    style={{
                                        flex: 1, border: 'none', borderRadius: 8, padding: '4px 0', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                        background: aiMode === m
                                            ? (m === 'turbo' ? 'linear-gradient(135deg,#ff00c8,#8b00ff)' : m === 'crazy' ? 'linear-gradient(135deg,#f97316,#ef4444)' : 'linear-gradient(135deg,#22c55e,#16a34a)')
                                            : 'rgba(0,0,0,0.08)',
                                        color: aiMode === m ? '#fff' : '#888',
                                    }}
                                >
                                    {m === 'normal' ? '🐢 Normal' : m === 'crazy' ? '🔥 Crazy 500%' : '⚡ Turbo 2000%'}
                                </button>
                            ))}
                        </div>

                        <div className='ai-assistant__footer'>
                            {scanning ? (
                                <button className='ai-assistant__btn ai-assistant__btn--cancel' onClick={stopScan}>⏹ Stop Scan</button>
                            ) : (
                                <button className='ai-assistant__btn ai-assistant__btn--scan' onClick={startScan}>🔍 SCAN ALL MARKETS</button>
                            )}
                            {/* FIRE NOW — fires exactly 3 trades then auto-stops */}
                            {!botRunning && (
                                <button
                                    className='ai-assistant__btn ai-assistant__btn--load'
                                    style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)', fontSize: '0.8rem' }}
                                    onClick={() => loadAndRun(best ?? DEFAULT_SIGNAL, 3)}
                                    disabled={!derivTrade.connected}
                                    title={!derivTrade.connected ? 'Waiting for account connection...' : 'Fires exactly 3 trades then auto-stops'}
                                >
                                    ⚡ FIRE NOW (3 runs)
                                </button>
                            )}
                            {/* Pause / Resume — only visible while bot is running */}
                            {botRunning && (
                                <button
                                    className='ai-assistant__btn'
                                    style={{
                                        background: botPaused
                                            ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                                            : 'linear-gradient(135deg,#eab308,#ca8a04)',
                                        color: '#fff',
                                        fontSize: '0.8rem',
                                    }}
                                    onClick={() => setBotPaused(p => !p)}
                                    title={botPaused ? 'Resume the bot — it will continue trading' : 'Pause the bot after the current trade settles'}
                                >
                                    {botPaused ? '▶ RESUME' : '⏸ PAUSE'}
                                </button>
                            )}
                            <button
                                className={`ai-assistant__btn ${botRunning ? 'ai-assistant__btn--stop-bot' : 'ai-assistant__btn--load'}`}
                                onClick={() => { if (botRunning) { setBotPaused(false); stopBot(); } else loadAndRun(); }}
                                disabled={!botRunning && (!best || !derivTrade.connected)}
                                title={!botRunning && !derivTrade.connected ? 'Waiting for account connection...' : undefined}
                            >
                                {botRunning ? `⏹ Stop Bot (#${tradeCount})` : !derivTrade.connected ? '— connecting to account —' : !best ? '— scan first —' : '⚡ Load & Run Bot'}
                            </button>
                        </div>
                        {/* Live-digit trigger + Auto-restart toggles */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setAutoRestart(p => !p)}
                                style={{ background: autoRestart ? '#00ff96' : 'rgba(255,255,255,0.1)', color: autoRestart ? '#000' : '#aaa', border: 'none', borderRadius: '12px', padding: '3px 10px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
                            >
                                🔄 AUTO-RESTART {autoRestart ? 'ON' : 'OFF'}
                            </button>
                            <button
                                onClick={() => setLiveDigitTrigger(p => !p)}
                                style={{ background: liveDigitTrigger ? '#f97316' : 'rgba(255,255,255,0.1)', color: liveDigitTrigger ? '#fff' : '#aaa', border: 'none', borderRadius: '12px', padding: '3px 10px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
                                title='When ON: auto-fires a trade the moment the live digit matches the barrier/entry digit'
                            >
                                🎯 DIGIT-MATCH TRIGGER {liveDigitTrigger ? 'ON' : 'OFF'}
                            </button>
                            <span style={{ fontSize: '0.66rem', color: '#666', width: '100%' }}>
                                {liveDigitTrigger ? `⚡ Will auto-fire when live digit = ${best ? (best.autoDigit ?? best.barrier ?? '?') : '?'}` : 'Digit trigger fires 1 trade on match'}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIAssistant;
