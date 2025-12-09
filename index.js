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
    { name: "로봇", value: "🤖" }
];

// 아스키아트 옵션
const asciiOptions = [
    { name: "하트", value: "꒰১♥໒꒱" },
    { name: "구름", value: "⋆°•☁︎⋆" },
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
    
    $("#chat .mes .mes_text").each(function() {
        const $mesText = $(this);
        applyHidingToElement($mesText, settings.rules);
    });
}

function applyHidingToElement($element, rules) {
    let html = $element.html();
    if (!html) return;
    
    // 이미 가려진 상태면 원본으로 저장하지 않음
    if (!$element.data("original-html")) {
        // 가려진 span이 포함되어 있으면 원본으로 저장하지 않음
        if (!html.includes('word-hider-hidden')) {
            $element.data("original-html", html);
        }
    }
    
    // 이미 가려진 상태에서 다시 적용하면 원본 HTML 사용
    if ($element.data("original-html")) {
        html = $element.data("original-html");
    }
    
    // 보호할 패턴들을 임시 플레이스홀더로 교체
    const protectedPatterns = [];
    let protectedIndex = 0;
    
    // {{태그::내용}} 패턴 보호 (예: {{img::filename.png}}, {{user}}, {{char}} 등)
    html = html.replace(/\{\{[^}]+\}\}/g, (match) => {
        const placeholder = `__WHPROTECTED_${protectedIndex}__`;
        protectedPatterns.push({ placeholder, original: match });
        protectedIndex++;
        return placeholder;
    });
    
    // HTML 태그 전체 보호 (속성값 포함, 예: <img src="...">, <a href="..."> 등)
    html = html.replace(/<[^>]+>/g, (match) => {
        const placeholder = `__WHPROTECTED_${protectedIndex}__`;
        protectedPatterns.push({ placeholder, original: match });
        protectedIndex++;
        return placeholder;
    });
    
    // 파일 경로 패턴 보호 (예: /path/to/file.png, ./file.png, ../folder/file.png)
    html = html.replace(/(?:\.{0,2}\/)?(?:[\w\-\.]+\/)+[\w\-\.]+\.\w+/g, (match) => {
        const placeholder = `__WHPROTECTED_${protectedIndex}__`;
        protectedPatterns.push({ placeholder, original: match });
        protectedIndex++;
        return placeholder;
    });
    
    // 파일명 패턴 보호 (확장자가 있는 파일명, 예: image.png, script.js)
    html = html.replace(/[\w\-]+\.(png|jpg|jpeg|gif|webp|svg|mp3|mp4|wav|ogg|js|css|html|json|txt|md)/gi, (match) => {
        if (match.includes('__WHPROTECTED_')) return match;
        const placeholder = `__WHPROTECTED_${protectedIndex}__`;
        protectedPatterns.push({ placeholder, original: match });
        protectedIndex++;
        return placeholder;
    });
    
    // 단어 가리기 규칙 적용
    rules.forEach(rule => {
        const replacement = createReplacement(rule);
        const regex = new RegExp(escapeRegExp(rule.word), 'gi');
        html = html.replace(regex, replacement);
    });
    
    // 보호된 패턴들 복원 (역순으로 복원하여 중첩 문제 방지)
    for (let i = protectedPatterns.length - 1; i >= 0; i--) {
        const { placeholder, original } = protectedPatterns[i];
        html = html.split(placeholder).join(original);
    }
    
    $element.html(html);
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
    $("#chat .mes .mes_text").each(function() {
        const $mesText = $(this);
        const original = $mesText.data("original-html");
        if (original) {
            $mesText.html(original);
            $mesText.removeData("original-html");
        } else {
            // original-html이 없는 경우, word-hider-hidden 스팬을 원래 단어로 복원
            let html = $mesText.html();
            if (html && html.includes('word-hider-hidden')) {
                html = html.replace(/<span class="word-hider-hidden"[^>]*data-word="([^"]*)"[^>]*>[^<]*<\/span>/gi, function(match, word) {
                    // HTML 엔티티 디코딩
                    const textarea = document.createElement('textarea');
                    textarea.innerHTML = word;
                    return textarea.value;
                });
                $mesText.html(html);
            }
        }
    });
}

function onMessageRendered(messageId) {
    const settings = getSettings();
    if (!settings.enabled || settings.rules.length === 0) {
        return;
    }
    
    setTimeout(() => {
        const $message = $(`#chat .mes[mesid="${messageId}"] .mes_text`);
        if ($message.length) {
            applyHidingToElement($message, settings.rules);
        }
    }, 100);
}

function onMessageUpdated(messageId) {
    const settings = getSettings();
    if (!settings.enabled || settings.rules.length === 0) {
        return;
    }
    
    setTimeout(() => {
        // messageId가 숫자인 경우
        if (typeof messageId === 'number' || !isNaN(messageId)) {
            const $message = $(`#chat .mes[mesid="${messageId}"] .mes_text`);
            if ($message.length) {
                // 편집 모드가 아닐 때만 적용
                if (!$message.find('textarea').length) {
                    // 기존 original-html 데이터 제거 (수정된 내용을 새 원본으로)
                    $message.removeData("original-html");
                    applyHidingToElement($message, settings.rules);
                }
            }
        } else {
            // messageId가 없거나 이상한 경우 전체 다시 적용
            applyWordHiding();
        }
    }, 300);  // 딜레이를 150에서 300으로 늘림
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

    // MutationObserver로 메시지 편집 완료 감지
    const chatElement = document.getElementById('chat');
    if (chatElement) {
        const chatObserver = new MutationObserver((mutations) => {
            const settings = getSettings();
            if (!settings.enabled || settings.rules.length === 0) {
                return;  // 비활성화 상태면 아무것도 하지 않음
            }
            
            let needsReapply = false;
            
            mutations.forEach((mutation) => {
                // 편집 모드 해제 감지 (textarea가 사라지면)
                if (mutation.type === 'childList') {
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            // textarea가 제거됨 = 편집 완료
                            if (node.tagName === 'TEXTAREA' || (node.querySelector && node.querySelector('textarea'))) {
                                needsReapply = true;
                            }
                        }
                    });
                    
                    // mes_text 내용이 변경된 경우
                    const target = mutation.target;
                    if (target.classList && target.classList.contains('mes_text')) {
                        // 편집 모드가 아닐 때만 (textarea가 없을 때)
                        if (!target.querySelector('textarea') && !target.closest('.mes')?.querySelector('.mes_block textarea')) {
                            needsReapply = true;
                        }
                    }
                }
            });
            
            if (needsReapply) {
                setTimeout(() => {
                    // 비활성화 상태면 재적용하지 않음
                    const currentSettings = getSettings();
                    if (!currentSettings.enabled) return;
                    
                    // 모든 메시지에서 original-html 초기화 후 다시 적용
                    $("#chat .mes .mes_text").each(function() {
                        const $mesText = $(this);
                        // 현재 textarea가 없는 경우만 (편집 중 아님)
                        if (!$mesText.find('textarea').length && !$mesText.closest('.mes').find('.mes_block textarea').length) {
                            // 가리기가 안 되어있으면 다시 적용 (조건 제거 - 항상 재적용)
                            $mesText.removeData("original-html");
                            applyHidingToElement($mesText, settings.rules);
                        }
                    });
                }, 300);  // 딜레이 200에서 300으로 늘림
            }
        });
        
        chatObserver.observe(chatElement, {
            childList: true,
            subtree: true
        });
        
        console.log("[Word Hider] MutationObserver initialized");
    }
    
    console.log("[Word Hider] Extension loaded successfully!");
});
