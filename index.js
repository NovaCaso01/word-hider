// 단어 가리기 (Word Hider) Extension for SillyTavern
// 메시지에서 특정 단어나 문장을 가리는 확장프로그램

import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "word-hider";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// 기본 설정
const defaultSettings = {
    enabled: true,
    rules: []
};

// 성능 최적화: 처리된 메시지 추적
const processedMessages = new WeakSet();
let debounceTimer = null;
let isProcessing = false;

// 이모지 옵션
const emojiOptions = [
    { name: "빨간 하트", value: "❤️" },
    { name: "주황 하트", value: "🧡" },
    { name: "노란 하트", value: "💛" },
    { name: "초록 하트", value: "💚" },
    { name: "파란 하트", value: "💙" },
    { name: "보라 하트", value: "💜" },
    { name: "검정 하트", value: "🖤" },
    { name: "흰 하트", value: "🤍" },
    { name: "펭귄", value: "🐧" },
    { name: "로봇", value: "🤖" },
    { name: "눈송이", value: "❄️" },
    { name: "별", value: "⭐" },
    { name: "달", value: "🌙" },
    { name: "토성", value: "🪐" },
    { name: "해바라기", value: "🌻" },
    { name: "벚꽃", value: "🌸" },
    { name: "네잎클로버", value: "🍀" },
    { name: "곰", value: "🐻" },
    { name: "판다", value: "🐼" },
    { name: "발자국", value: "🐾" },
    { name: "병아리", value: "🐤" },
    { name: "토끼", value: "🐰" },
    { name: "햄스터", value: "🐹" },
    { name: "강아지", value: "🐶" },
    { name: "늑대", value: "🐺" },
    { name: "여우", value: "🦊" },
    { name: "라쿤", value: "🦝" },
    { name: "고양이", value: "🐱" },
    { name: "사자", value: "🦁" },
    { name: "호랑이", value: "🐯" }
];

// 아스키아트 옵션
const asciiOptions = [
    { name: "하트", value: "꒰১♥໒꒱" },
    { name: "구름", value: "⋆°•☁︎⋆" },
    { name: "꽃", value: "°•. ✿ .•°" },
    { name: "달", value: "∘*┈🌙┈*∘" },
    { name: "나비", value: "˚∘⊹🦋⊹∘˚" },
    { name: "리본", value: "⊹˟༝🎀˖˟⊹" }
];

// 설정 로드
async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    
    if (extension_settings[extensionName].enabled === undefined) {
        extension_settings[extensionName].enabled = true;
    }
    if (!extension_settings[extensionName].rules) {
        extension_settings[extensionName].rules = [];
    }
}

function getSettings() {
    return extension_settings[extensionName];
}

// 규칙 목록 UI 렌더링
function renderRulesList() {
    const settings = getSettings();
    const container = $("#word-hider-rules-list");
    container.empty();
    
    if (settings.rules.length === 0) {
        container.append('<div class="word-hider-empty">가릴 단어가 없습니다. 위에서 추가해주세요.</div>');
        return;
    }
    
    settings.rules.forEach((rule, index) => {
        const hideDisplay = getHideDisplay(rule);
        const ruleHtml = `
            <div class="word-hider-rule-item" data-index="${index}">
                <div class="word-hider-rule-info">
                    <span class="word-hider-rule-word">"${escapeHtml(rule.word)}"</span>
                    <span class="word-hider-rule-arrow">→</span>
                    <span class="word-hider-rule-preview">${hideDisplay}</span>
                </div>
                <div class="word-hider-rule-actions">
                    <button class="word-hider-edit-btn menu_button" data-index="${index}" title="수정">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="word-hider-delete-btn menu_button" data-index="${index}" title="삭제">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        container.append(ruleHtml);
    });
    
    $(".word-hider-delete-btn").off("click").on("click", function() {
        const index = $(this).data("index");
        deleteRule(index);
    });
    
    $(".word-hider-edit-btn").off("click").on("click", function() {
        const index = $(this).data("index");
        editRule(index);
    });
}

function getHideDisplay(rule) {
    switch (rule.hideType) {
        case 'color':
            return `<span class="word-hider-color-preview" style="background-color: ${rule.hideValue}; padding: 2px 8px; border-radius: 3px;">&nbsp;&nbsp;&nbsp;</span>`;
        case 'emoji':
            return emojiOptions[rule.hideValue]?.value || "❤️";
        case 'ascii':
            return asciiOptions[rule.hideValue]?.value || "⋆°•☁︎⋆";
        default:
            return "???";
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function deleteRule(index) {
    const settings = getSettings();
    settings.rules.splice(index, 1);
    saveSettingsDebounced();
    renderRulesList();
    applyWordHiding();
}

function editRule(index) {
    const settings = getSettings();
    const rule = settings.rules[index];
    
    $("#word-hider-word-input").val(rule.word);
    $("#word-hider-hide-type").val(rule.hideType).trigger("change");
    
    if (rule.hideType === 'color') {
        $("#word-hider-color-picker").val(rule.hideValue);
    } else if (rule.hideType === 'emoji') {
        $("#word-hider-emoji-select").val(rule.hideValue);
    } else if (rule.hideType === 'ascii') {
        $("#word-hider-ascii-select").val(rule.hideValue);
    }
    
    $("#word-hider-add-btn").data("edit-index", index).html('<i class="fa-solid fa-check"></i> 수정');
}

function addOrUpdateRule() {
    const word = $("#word-hider-word-input").val().trim();
    if (!word) {
        toastr.warning("가릴 단어를 입력해주세요.");
        return;
    }
    
    const hideType = $("#word-hider-hide-type").val();
    let hideValue;
    
    switch (hideType) {
        case 'color':
            hideValue = $("#word-hider-color-picker").val();
            break;
        case 'emoji':
            hideValue = parseInt($("#word-hider-emoji-select").val());
            break;
        case 'ascii':
            hideValue = parseInt($("#word-hider-ascii-select").val());
            break;
    }
    
    const settings = getSettings();
    const editIndex = $("#word-hider-add-btn").data("edit-index");
    
    const newRule = {
        id: Date.now(),
        word: word,
        hideType: hideType,
        hideValue: hideValue
    };
    
    if (editIndex !== undefined && editIndex !== null && editIndex !== "") {
        settings.rules[editIndex] = newRule;
        $("#word-hider-add-btn").removeData("edit-index").html('<i class="fa-solid fa-plus"></i> 추가');
    } else {
        settings.rules.push(newRule);
    }
    
    saveSettingsDebounced();
    renderRulesList();
    applyWordHiding();
    
    $("#word-hider-word-input").val("");
}

function onHideTypeChange() {
    const type = $("#word-hider-hide-type").val();
    
    $(".word-hider-option-group").hide();
    
    switch (type) {
        case 'color':
            $("#word-hider-color-group").show();
            break;
        case 'emoji':
            $("#word-hider-emoji-group").show();
            break;
        case 'ascii':
            $("#word-hider-ascii-group").show();
            break;
    }
}

function onToggleChange() {
    const enabled = $("#word-hider-toggle").prop("checked");
    const settings = getSettings();
    settings.enabled = enabled;
    saveSettingsDebounced();
    applyWordHiding();
    
    if (enabled) {
        toastr.success("단어 가리기가 활성화되었습니다.");
    } else {
        toastr.info("단어 가리기가 비활성화되었습니다.");
    }
}

function applyWordHiding() {
    const settings = getSettings();
    
    removeWordHiding();
    
    if (!settings.enabled || settings.rules.length === 0) {
        return;
    }
    
    // 성능 최적화: 화면에 보이는 메시지만 우선 처리
    const chatContainer = document.getElementById('chat');
    if (!chatContainer) return;
    
    const messages = chatContainer.querySelectorAll('.mes .mes_text');
    const visibleMessages = [];
    const hiddenMessages = [];
    
    // 화면에 보이는 메시지와 안 보이는 메시지 분리
    messages.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            visibleMessages.push(el);
        } else {
            hiddenMessages.push(el);
        }
    });
    
    // 화면에 보이는 메시지 즉시 처리
    visibleMessages.forEach(el => {
        applyHidingToElement($(el), settings.rules);
    });
    
    // 안 보이는 메시지는 idle 콜백으로 처리 (모바일 성능 개선)
    if (hiddenMessages.length > 0 && 'requestIdleCallback' in window) {
        requestIdleCallback(() => {
            hiddenMessages.forEach(el => {
                applyHidingToElement($(el), settings.rules);
            });
        }, { timeout: 2000 });
    } else if (hiddenMessages.length > 0) {
        // requestIdleCallback 미지원 시 setTimeout으로 대체
        setTimeout(() => {
            hiddenMessages.forEach(el => {
                applyHidingToElement($(el), settings.rules);
            });
        }, 100);
    }
}

function applyHidingToElement($element, rules) {
    const el = $element[0];
    if (!el) return;
    
    let html = el.innerHTML;
    if (!html) return;
    
    // 이미 처리된 요소는 스킵 (성능 최적화)
    if (processedMessages.has(el) && html.includes('word-hider-hidden')) {
        return;
    }
    
    // 이미 가려진 상태면 원본으로 저장하지 않음
    const storedOriginal = $element.data("original-html");
    if (!storedOriginal && !html.includes('word-hider-hidden')) {
        $element.data("original-html", html);
    }
    
    // 이미 가려진 상태에서 다시 적용하면 원본 HTML 사용
    if (storedOriginal) {
        html = storedOriginal;
    }
    
    // 빠른 체크: 가릴 단어가 있는지 먼저 확인 (없으면 스킵)
    const hasMatch = rules.some(rule => html.toLowerCase().includes(rule.word.toLowerCase()));
    if (!hasMatch) {
        processedMessages.add(el);
        return;
    }
    
    // 보호할 패턴들을 한 번에 처리 (정규식 결합)
    const protectedPatterns = [];
    let protectedIndex = 0;
    
    // 통합 정규식으로 한 번에 처리 (성능 개선)
    const protectRegex = /\{\{[^}]+\}\}|<[^>]+>|(?:\.{0,2}\/)?(?:[\w\-\.]+\/)+[\w\-\.]+\.\w+|[\w\-]+\.(?:png|jpg|jpeg|gif|webp|svg|mp3|mp4|wav|ogg|js|css|html|json|txt|md)/gi;
    
    html = html.replace(protectRegex, (match) => {
        const placeholder = `\x00${protectedIndex}\x00`;
        protectedPatterns.push(match);
        protectedIndex++;
        return placeholder;
    });
    
    // 규칙을 단어 길이순으로 내림차순 정렬 (긴 단어 먼저 처리하여 중첩 문제 방지)
    const sortedRules = [...rules].sort((a, b) => b.word.length - a.word.length);
    
    // 모든 단어를 하나의 정규식으로 합쳐서 한 번에 처리 (중첩 문제 완전 해결)
    const ruleMap = new Map();
    sortedRules.forEach(rule => {
        ruleMap.set(rule.word.toLowerCase(), rule);
    });
    
    // 긴 단어 우선으로 정렬된 패턴들을 OR로 연결
    const combinedPattern = sortedRules
        .map(rule => escapeRegExp(rule.word))
        .join('|');
    
    if (combinedPattern) {
        const combinedRegex = new RegExp(combinedPattern, 'gi');
        html = html.replace(combinedRegex, (match) => {
            const rule = ruleMap.get(match.toLowerCase());
            if (rule) {
                if (!rule._cachedReplacement) {
                    rule._cachedReplacement = createReplacement(rule);
                }
                return rule._cachedReplacement;
            }
            return match;
        });
    }
    
    // 보호된 패턴들 복원
    html = html.replace(/\x00(\d+)\x00/g, (_, idx) => protectedPatterns[parseInt(idx)]);
    
    el.innerHTML = html;
    processedMessages.add(el);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createReplacement(rule) {
    let content;
    let style = "";
    
    switch (rule.hideType) {
        case 'color':
            content = "&nbsp;".repeat(3);
            style = `background-color: ${rule.hideValue}; padding: 1px 4px; border-radius: 3px; display: inline-block;`;
            break;
        case 'emoji':
            content = emojiOptions[rule.hideValue]?.value || "❤️";
            break;
        case 'ascii':
            content = asciiOptions[rule.hideValue]?.value || "⋆°•☁︎⋆";
            break;
        default:
            content = "***";
    }
    
    return `<span class="word-hider-hidden" data-word="${escapeHtml(rule.word)}" style="${style}" title="가려진 단어">${content}</span>`;
}

function removeWordHiding() {
    const messages = document.querySelectorAll("#chat .mes .mes_text");
    
    messages.forEach(el => {
        const $mesText = $(el);
        const original = $mesText.data("original-html");
        
        if (original) {
            el.innerHTML = original;
            $mesText.removeData("original-html");
        } else {
            // original-html이 없는 경우, word-hider-hidden 스팬을 원래 단어로 복원
            let html = el.innerHTML;
            if (html && html.includes('word-hider-hidden')) {
                html = html.replace(/<span class="word-hider-hidden"[^>]*data-word="([^"]*)"[^>]*>[^<]*<\/span>/gi, (match, word) => {
                    const textarea = document.createElement('textarea');
                    textarea.innerHTML = word;
                    return textarea.value;
                });
                el.innerHTML = html;
            }
        }
    });
    
    // 규칙 캐시 클리어
    const settings = getSettings();
    if (settings.rules) {
        settings.rules.forEach(rule => {
            delete rule._cachedReplacement;
            delete rule._cachedRegex;
        });
    }
}

function onMessageRendered(messageId) {
    const settings = getSettings();
    if (!settings.enabled || settings.rules.length === 0) {
        return;
    }
    
    // requestAnimationFrame으로 렌더링 최적화
    requestAnimationFrame(() => {
        const message = document.querySelector(`#chat .mes[mesid="${messageId}"] .mes_text`);
        if (message) {
            applyHidingToElement($(message), settings.rules);
        }
    });
}

function onMessageUpdated(messageId) {
    const settings = getSettings();
    if (!settings.enabled || settings.rules.length === 0) {
        return;
    }
    
    // requestAnimationFrame + 짧은 딜레이
    requestAnimationFrame(() => {
        setTimeout(() => {
            if (typeof messageId === 'number' || !isNaN(messageId)) {
                const message = document.querySelector(`#chat .mes[mesid="${messageId}"] .mes_text`);
                if (message) {
                    const $message = $(message);
                    if (!message.querySelector('textarea')) {
                        $message.removeData("original-html");
                        applyHidingToElement($message, settings.rules);
                    }
                }
            } else {
                applyWordHiding();
            }
        }, 150);
    });
}

function openWordHiderPopup() {
    const settings = getSettings();
    $("#word-hider-toggle").prop("checked", settings.enabled);
    renderRulesList();
    $("#word-hider-popup").addClass("open");
}

function closeWordHiderPopup() {
    $("#word-hider-popup").removeClass("open");
    $("#word-hider-add-btn").removeData("edit-index").html('<i class="fa-solid fa-plus"></i> 추가');
    $("#word-hider-word-input").val("");
}

// 확장 메뉴에 버튼 추가 - 타이밍 문제 해결
function addExtensionMenuButton() {
    // 이미 추가된 경우 스킵
    if ($("#word-hider-menu-item").length > 0) {
        return;
    }
    
    const extensionsMenu = document.getElementById("extensionsMenu");
    if (!extensionsMenu) {
        console.log("[Word Hider] extensionsMenu not found, retrying...");
        setTimeout(addExtensionMenuButton, 1000);
        return;
    }
    
    const menuItem = document.createElement("div");
    menuItem.id = "word-hider-menu-item";
    menuItem.className = "list-group-item flex-container flexGap5";
    menuItem.innerHTML = `
        <div class="fa-solid fa-eye-slash extensionsMenuExtensionButton"></div>
        단어 가리기
    `;
    
    menuItem.addEventListener("click", function() {
        openWordHiderPopup();
        $("#extensionsMenu").hide();
    });
    
    extensionsMenu.appendChild(menuItem);
    console.log("[Word Hider] Menu button added successfully!");
}

// jQuery 초기화
jQuery(async () => {
    console.log("[Word Hider] Extension loading...");
    
    // HTML 로드 및 추가
    try {
        const popupHtml = await $.get(`${extensionFolderPath}/popup.html`);
        $("body").append(popupHtml);
        console.log("[Word Hider] Popup HTML loaded");
    } catch (error) {
        console.error("[Word Hider] Failed to load popup.html:", error);
        return;
    }
    
    // 이모지 옵션 생성
    const emojiSelect = $("#word-hider-emoji-select");
    emojiOptions.forEach((emoji, index) => {
        emojiSelect.append(`<option value="${index}">${emoji.value} ${emoji.name}</option>`);
    });
    
    // 아스키아트 옵션 생성
    const asciiSelect = $("#word-hider-ascii-select");
    asciiOptions.forEach((ascii, index) => {
        asciiSelect.append(`<option value="${index}">${ascii.value}</option>`);
    });
    
    // 설정 로드
    await loadSettings();
    
    // 이벤트 바인딩
    $("#word-hider-toggle").on("change", onToggleChange);
    $("#word-hider-hide-type").on("change", onHideTypeChange);
    $("#word-hider-add-btn").on("click", addOrUpdateRule);
    $("#word-hider-close-btn").on("click", closeWordHiderPopup);
    $("#word-hider-popup-overlay").on("click", closeWordHiderPopup);
    
    $("#word-hider-word-input").on("keypress", function(e) {
        if (e.key === "Enter") {
            addOrUpdateRule();
        }
    });
    
    // 초기 타입 표시
    onHideTypeChange();
    
    // UI 초기화
    const settings = getSettings();
    $("#word-hider-toggle").prop("checked", settings.enabled);
    
    // 확장 메뉴에 버튼 추가 (딜레이 후)
    setTimeout(addExtensionMenuButton, 2000);
    
// 이벤트 리스너 등록 - SillyTavern의 eventSource 사용
if (eventSource) {
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, onMessageRendered);
    eventSource.on(event_types.MESSAGE_UPDATED, onMessageUpdated);
    eventSource.on(event_types.MESSAGE_EDITED, onMessageUpdated);
    eventSource.on(event_types.MESSAGE_SWIPED, onMessageUpdated);
    eventSource.on(event_types.CHAT_CHANGED, () => {
        setTimeout(applyWordHiding, 500);
    });
}
    
    // 초기 적용
    setTimeout(applyWordHiding, 1000);

    // MutationObserver로 메시지 편집 완료 감지 (최적화됨)
    const chatElement = document.getElementById('chat');
    if (chatElement) {
        // 디바운스된 재적용 함수
        const debouncedReapply = (targetElements) => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            
            debounceTimer = setTimeout(() => {
                if (isProcessing) return;
                isProcessing = true;
                
                const currentSettings = getSettings();
                if (!currentSettings.enabled) {
                    isProcessing = false;
                    return;
                }
                
                // 변경된 요소만 처리 (전체 순회 안 함)
                if (targetElements && targetElements.size > 0) {
                    targetElements.forEach(el => {
                        const $mesText = $(el);
                        if (!$mesText.find('textarea').length) {
                            $mesText.removeData("original-html");
                            applyHidingToElement($mesText, currentSettings.rules);
                        }
                    });
                }
                
                isProcessing = false;
            }, 300);
        };
        
        const chatObserver = new MutationObserver((mutations) => {
            const settings = getSettings();
            if (!settings.enabled || settings.rules.length === 0) {
                return;
            }
            
            // 변경된 mes_text 요소만 수집
            const changedElements = new Set();
            
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') continue;
                
                // textarea 제거 감지 (편집 완료)
                for (const node of mutation.removedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.tagName === 'TEXTAREA' || (node.querySelector && node.querySelector('textarea'))) {
                        const mesText = mutation.target.closest('.mes_text') || 
                                        mutation.target.closest('.mes')?.querySelector('.mes_text');
                        if (mesText) changedElements.add(mesText);
                    }
                }
                
                // mes_text 직접 변경 감지
                const target = mutation.target;
                if (target.classList?.contains('mes_text')) {
                    if (!target.querySelector('textarea') && !target.closest('.mes')?.querySelector('.mes_block textarea')) {
                        changedElements.add(target);
                    }
                }
            }
            
            // 변경된 요소가 있을 때만 처리
            if (changedElements.size > 0) {
                debouncedReapply(changedElements);
            }
        });
        
        chatObserver.observe(chatElement, {
            childList: true,
            subtree: true
        });
        
        console.log("[Word Hider] MutationObserver initialized (optimized)");
    }
    
    console.log("[Word Hider] Extension loaded successfully!");
});
