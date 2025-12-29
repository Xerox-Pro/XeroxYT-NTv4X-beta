
import React from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon } from './icons/Icons';

interface UpdateAnnouncementModalProps {
    onClose: () => void;
}

const UpdateAnnouncementModal: React.FC<UpdateAnnouncementModalProps> = ({ onClose }) => {
    return createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] flex items-center justify-center animate-fade-in p-4" onClick={onClose}>
            <div 
                className="bg-yt-white dark:bg-yt-light-black w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-yt-spec-light-20 dark:border-yt-spec-20 max-h-[90vh] overflow-y-auto" 
                onClick={e => e.stopPropagation()}
            >
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white text-center">
                    <h2 className="text-2xl font-bold mb-1">Update Information</h2>
                    <p className="text-white/80 text-sm">XeroxYT-NTv4X Latest Changes</p>
                </div>
                
                <div className="p-6 md:p-8">
                    <h3 className="text-lg font-bold text-black dark:text-white mb-4 border-b border-yt-spec-light-20 dark:border-yt-spec-20 pb-2">
                        更新内容
                    </h3>
                    
                    <ul className="space-y-6 mb-8">
                        <li className="flex items-start gap-3">
                            <div className="mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full text-green-600 dark:text-green-400 flex-shrink-0">
                                <CheckIcon className="w-6 h-6 fill-current" />
                            </div>
                            <div>
                                <strong className="block text-black dark:text-white text-lg mb-1">XeroxYT-NTv4X リリース</strong>
                                <span className="text-sm text-yt-light-gray leading-relaxed">
                                    XeroxYT-NTv4Xがリリースされました。Google Apps Script (GAS) 環境での動作に完全対応（GASオンリー）し、よりシンプルで高速な動作を実現しました。
                                </span>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 bg-blue-100 dark:bg-blue-900/30 p-1 rounded-full text-blue-600 dark:text-blue-400 flex-shrink-0">
                                <CheckIcon className="w-6 h-6 fill-current" />
                            </div>
                            <div>
                                <strong className="block text-black dark:text-white text-lg mb-1">クラウドログイン機能の搭載</strong>
                                <span className="text-sm text-yt-light-gray leading-relaxed">
                                    新しいログイン機能により、登録チャンネルや視聴履歴をクラウドに保存できるようになりました。これにより、デバイス間でのデータ移行や、誤ってデータを消してしまった際の復元が簡単に行えます。
                                </span>
                            </div>
                        </li>
                    </ul>

                    <div className="flex justify-center">
                        <button 
                            onClick={onClose}
                            className="bg-black dark:bg-white text-white dark:text-black font-bold py-3 px-8 rounded-full hover:opacity-80 transition-opacity shadow-lg w-full sm:w-auto"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default UpdateAnnouncementModal;
