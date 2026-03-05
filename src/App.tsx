/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  FileText, 
  Activity, 
  Pill, 
  ShieldCheck, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from '@/src/lib/utils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Initialize Gemini API - Moved inside runAnalysis for reliability

type AnalysisState = 'idle' | 'uploading' | 'analyzing' | 'completed' | 'error';

export default function App() {
  const [fileData, setFileData] = useState<{ data: string, mimeType: string } | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [status, setStatus] = useState<AnalysisState>('idle');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const resetAll = () => {
    setFileData(null);
    setManualInput('');
    setStatus('idle');
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('이미지(JPG, PNG, WEBP) 또는 PDF 파일만 업로드 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = (e.target?.result as string).split(',')[1];
      setFileData({ data: base64Data, mimeType: file.type });
      setError(null);
      setStatus('idle');
    };
    reader.readAsDataURL(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const runAnalysis = async () => {
    if (!fileData && !manualInput.trim()) {
      setError("분석할 파일이나 증상을 입력해주세요.");
      return;
    }

    setStatus('analyzing');
    setError(null);

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-flash-latest";

      const prompt = `
# Role: 영양 의학 및 유사나(USANA) 전문 AI 어드바이저

당신은 제공된 지식 자료(영양 의학, 드럭 머거 이론, 유사나 제품 정보)를 완벽히 숙지한 전문가입니다. 사용자가 제공한 [양자기 리포트], [건강검진 데이터], [처방전/약봉지] 사진/PDF 또는 [수기 입력된 증상/질병명]을 분석하여, **반드시 제공된 지식 체계 내에서** 세포 건강 중심의 통합 솔루션을 제공합니다.

${manualInput.trim() ? `\n[사용자 입력 증상/질병명]:\n${manualInput}\n` : ''}

# Core Knowledge & Philosophy (분석 기준):
1. **질병의 근원**: 모든 질병의 뿌리는 '산화 스트레스'와 '세포 영양 불균형'에 있습니다.
2. **현대의학의 한계와 드럭 머거**: 약물은 증상을 완화하지만 필수 영양소를 고갈시킵니다. 분석 시 복용 약물에 따른 고갈 영양소를 반드시 찾아내어 처방에 반영하십시오.
3. **유사나(USANA) 솔루션**: 모든 영양 처방은 유사나의 제품을 기준으로 합니다.
   - **헬스팩**: 14가지 비타민, 9가지 미네랄, 7가지 식물성분(인셀리전스 컴플렉스)이 함유된 종합 영양제. 세포 영양, 보호, 재생을 돕는 독보적인 기술력 강조.
   - **써큘레이트 플러스**: 1포를 250~300ml 물에 타서 섭취하는 혈행 개선 신제품.
   - **코어 아미노 드링크**: 분말로 1스쿱을 물에 타서 섭취하는 근육 건강과 에너지를 위한 신제품.
   - **프로후라바놀 C300**: 기존 C600은 단종되었으므로 반드시 C300으로 처방.
   - **바이오메가**: 혈행 관련 이슈가 있을 경우 항상 필수 처방.

# Analysis Protocol (수행 절차):
1. **데이터 정밀 추출**: 이미지/PDF/텍스트에서 모든 건강 지표와 약물명을 정확히 추출하십시오.
2. **세포 수준 원인 분석**: 추출된 지표가 나쁜 이유를 산화 스트레스와 영양 불균형 관점에서 설명하십시오.
3. **현대의학적 치료 분석 및 드럭 머거**: 
   - 현재 복용 중인 약물 치료나 수술 등의 목적을 설명하십시오.
   - 이러한 치료가 근본 원인 해결이 아닌 '대증요법(증상 완화)'에 치중되어 있음을 강조하십시오.
   - 해당 약물이 체내에서 뺏어가는 영양소(Drug Mugger)를 구체적으로 명시하십시오.
4. **유사나 제품 처방**: 
   - **기초 영양**: 헬스팩(CellSentials)을 기본으로 처방하십시오.
   - **집중 케어(Optimizers)**: 증상과 지표에 따라 써큘레이트 플러스, 코어 아미노 드링크, 코퀴논 30, 바이오메가, 프로후라바놀 C300, 마그네칼D, 헤파실 등을 정확히 매칭하십시오.

# Report Structure (반드시 이 순서로 출력):
## 1. 종합 건강 진단 결과
- 현재 건강 등급 및 핵심 관리 지표 요약.
## 2. 질병의 원인과 세포 건강 상태
- 영양 의학 이론에 기반한 산화 스트레스 및 세포 손상 분석.
## 3. 현대의학적 치료와 그 한계 (대증요법 및 드럭 머거)
- **치료 방법 분석**: 현재 시행 중인 약물/수술 치료의 목적.
- **대증요법의 한계**: 근본 원인(세포 영양) 해결이 아닌 증상 억제 위주의 치료임을 설명.
- **드럭 머거(Drug Mugger) 경고**: 약물명 -> 고갈 영양소 -> 보충이 필요한 이유와 잠재적 부작용.
## 4. 기능의학적 맞춤 솔루션
- 세포 복구 및 항산화를 위한 핵심 영양 전략.
- **필요 영양소 상세 설명**: 왜 이 영양소들이 필요한지 세포 수준에서 자세히 설명하십시오.
## 5. 유사나(USANA) 영양 처방전
- **추천 제품 리스트**: 제품명, 핵심 성분 및 기술, 기대 효과. (써큘레이트 플러스, 코어 아미노 드링크 등 신제품 적극 활용)
- **섭취 방법**: 최적의 효과를 위한 가이드. (예: 써큘레이트 플러스는 물 250~300ml에 1포, 코어 아미노 드링크는 물에 1스쿱 타서 섭취)
## 6. 생활 습관 및 식단 가이드
- 혈당 관리, 항산화 식단, 수분 섭취 등 제안.

# Tone & Manner:
- 지식 자료에 근거한 확신 있고 전문적인 어조.
- **중요: 도표(Table)를 절대 사용하지 마십시오.** 대신 불렛 포인트(Bullet points)나 번호가 매겨진 리스트를 사용하여 가독성 있게 작성하십시오.
- 모든 처방은 유사나 제품의 우수성과 과학적 근거를 바탕으로 작성.
- 한국어 사용.
      `;

      const parts: any[] = [{ text: prompt }];
      if (fileData) {
        parts.push({
          inlineData: {
            mimeType: fileData.mimeType,
            data: fileData.data
          }
        });
      }

      const result = await ai.models.generateContent({
        model: model,
        contents: { parts }
      });

      setResult(result.text || "분석 결과를 생성할 수 없습니다.");
      setStatus('completed');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "분석 중 오류가 발생했습니다. 다시 시도해주세요.");
      setStatus('error');
    }
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`CellHealth_Report_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('PDF 저장 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-none">CellHealth AI</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">Nutritional Medicine Advisor</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-emerald-600 transition-colors">Philosophy</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">USANA Solutions</a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input & Info */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-2">데이터 분석 시작</h2>
              <p className="text-sm text-slate-500 mb-6">양자기 리포트, 건강검진 결과, 또는 처방전 사진/PDF를 업로드하거나 증상을 입력하세요.</p>
              
              <div className="space-y-4">
                {/* File Upload Area */}
                <div 
                  className={cn(
                    "relative border-2 border-dashed rounded-2xl p-6 transition-all duration-200 flex flex-col items-center justify-center gap-3 cursor-pointer group",
                    fileData ? "border-emerald-500 bg-emerald-50/30" : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50"
                  )}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*,.pdf"
                  />
                  
                  {fileData ? (
                    <div className="flex flex-col items-center gap-2">
                      {fileData.mimeType === 'application/pdf' ? (
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shadow-sm">
                          <FileText size={32} />
                        </div>
                      ) : (
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden shadow-md">
                          <img src={`data:${fileData.mimeType};base64,${fileData.data}`} alt="Uploaded" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <p className="text-xs font-medium text-emerald-700">파일이 선택되었습니다</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:bg-emerald-50 transition-colors">
                        <Upload size={24} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-700">파일 업로드 (사진 또는 PDF)</p>
                        <p className="text-[10px] text-slate-400 mt-1">JPG, PNG, PDF (최대 10MB)</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Manual Input Area */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">증상 및 질병명 직접 입력</label>
                  <textarea
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="예: 당뇨, 고혈압 약 복용 중, 최근 만성 피로가 심함, 손발 저림 등..."
                    className="w-full h-32 p-4 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm resize-none bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  disabled={(!fileData && !manualInput.trim()) || status === 'analyzing'}
                  onClick={runAnalysis}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg",
                    (!fileData && !manualInput.trim()) || status === 'analyzing' 
                      ? "bg-slate-300 cursor-not-allowed shadow-none" 
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 active:scale-[0.98]"
                  )}
                >
                  {status === 'analyzing' ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Activity size={20} />
                      분석 시작
                    </>
                  )}
                </button>
                
                <button
                  onClick={resetAll}
                  className="px-6 py-4 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex items-center justify-center"
                  title="초기화"
                >
                  <RotateCcw size={20} />
                </button>
              </div>
            </section>

            {/* Info Cards */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-emerald-900 text-white rounded-3xl p-6 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-lg font-bold mb-2">Nutritional Medicine</h3>
                  <p className="text-sm text-emerald-100 leading-relaxed">
                    "질병의 뿌리는 산화 스트레스에 있습니다. 최적의 영양 공급만이 세포를 보호하고 치유할 수 있습니다."
                  </p>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                  <ShieldCheck size={120} />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Pill size={20} />
                  </div>
                  <h3 className="font-bold text-slate-900">Drug Mugger Warning</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  우리가 복용하는 약물은 증상을 완화하지만, 동시에 필수 영양소를 고갈시킵니다. 고갈된 영양소를 보충하지 않으면 새로운 부작용이 발생할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {status === 'idle' && !result && (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-slate-200 border-dashed"
                >
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                    <FileText size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">분석 대기 중</h3>
                  <p className="text-slate-500 max-w-xs">왼쪽에서 데이터를 업로드하고 분석 시작 버튼을 눌러주세요.</p>
                </motion.div>
              )}

              {status === 'analyzing' && (
                <motion.div 
                  key="analyzing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-slate-200"
                >
                  <div className="relative mb-8">
                    <div className="w-24 h-24 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                      <Activity size={32} className="animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-4">세포 데이터를 해독하고 있습니다</h3>
                  <div className="space-y-2 text-sm text-slate-500">
                    <p className="animate-pulse">이미지에서 수치를 추출하는 중...</p>
                    <p className="animate-pulse delay-75">드럭 머거 위험 요소를 분석하는 중...</p>
                    <p className="animate-pulse delay-150">최적의 영양 처방을 구성하는 중...</p>
                  </div>
                </motion.div>
              )}

              {status === 'error' && (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-red-100"
                >
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-6">
                    <AlertCircle size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">분석 실패</h3>
                  <p className="text-slate-500 mb-6">{error}</p>
                  <button 
                    onClick={() => setStatus('idle')}
                    className="px-6 py-2 bg-slate-900 text-white rounded-xl font-medium"
                  >
                    다시 시도하기
                  </button>
                </motion.div>
              )}

              {result && (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden"
                >
                  <div className="bg-emerald-600 p-6 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={24} />
                      <h3 className="text-lg font-bold">맞춤형 영양 의학 분석 리포트</h3>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        disabled={isExporting}
                        onClick={exportToPDF}
                        className="text-xs font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        PDF 저장
                      </button>
                      <button 
                        onClick={() => window.print()}
                        className="text-xs font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        인쇄
                      </button>
                    </div>
                  </div>
                  <div className="p-8" ref={reportRef}>
                    <div className="markdown-body">
                      <Markdown>{result}</Markdown>
                    </div>
                    
                    <div className="mt-12 pt-8 border-t border-slate-100">
                      <div className="bg-slate-50 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-24 h-24 bg-white rounded-xl shadow-sm flex items-center justify-center p-4">
                          <img 
                            src="https://picsum.photos/seed/usana-logo/200/200" 
                            alt="USANA" 
                            className="w-full h-auto grayscale opacity-50"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <h4 className="font-bold text-slate-900 mb-1">유사나(USANA) 솔루션 안내</h4>
                          <p className="text-sm text-slate-500 mb-4">본 리포트에서 추천된 제품은 인셀리전스 기술이 적용된 유사나의 프리미엄 영양제입니다.</p>
                          <a 
                            href="https://issuu.com/usanakorea/docs/_18b387dc56d8e8" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-emerald-600 font-bold text-sm hover:underline"
                          >
                            제품 상세 정보 보기 <ArrowRight size={16} />
                          </a>
                        </div>
                      </div>
                    </div>

                    <p className="mt-8 text-[11px] text-slate-400 text-center leading-relaxed">
                      본 분석 결과는 영양 의학 이론을 바탕으로 한 AI의 제안이며, 질병의 진단이나 치료를 위한 의학적 소견이 아닙니다. <br />
                      심각한 질환이 있는 경우 반드시 전문의와 상의하십시오.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 mt-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 text-white mb-4">
                <ShieldCheck size={20} className="text-emerald-500" />
                <span className="font-bold">CellHealth AI</span>
              </div>
              <p className="text-xs leading-relaxed">
                세포 건강을 최우선으로 생각하는 영양 의학 AI 어드바이저입니다. 
                영양 의학의 철학을 현대 기술로 재해석합니다.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">Resources</h4>
              <ul className="text-xs space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">영양의학가이드</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Drug Mugger Guide</a></li>
                <li><a href="#" className="hover:text-white transition-colors">USANA InCelligence</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 text-[10px] flex flex-col sm:flex-row justify-between items-center gap-4">
            <p>© 2026 CellHealth AI Advisor. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
