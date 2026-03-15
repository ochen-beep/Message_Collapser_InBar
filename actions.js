// actions.js - Handles message manipulation and UI actions for Message_Collapser

export const arrowClass = 'message-collapser-arrow';
export const collapsedClass = 'message-collapser-message-collapsed';

// Function to add collapse/expand arrows to messages
export function addCollapseArrowsToMessages() {
    console.log("Message Collapser: Adding collapse arrows.");
    $('.mes').each(function() {
        const message = $(this);
        if (message.find('.' + arrowClass).length === 0) {
            const arrowElement = $('<div class="mes_button ' + arrowClass + '" title="Свернуть/развернуть сообщение"><i class="fas fa-chevron-up"></i></div>');
            // Insert as the first button in the message action bar
            const buttonsContainer = message.find('.mes_buttons');
            if (buttonsContainer.length) {
                buttonsContainer.prepend(arrowElement);
            } else {
                // Fallback: prepend to message block if buttons container not found
                message.prepend(arrowElement);
            }
        }
    });
}

// Observer to add arrows to newly added messages (e.g. streaming)
let _collapserObserver = null;

export function startObserver() {
    if (_collapserObserver) return;
    const chat = document.getElementById('chat');
    if (!chat) return;
    _collapserObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1 && node.classList && node.classList.contains('mes')) {
                    const message = $(node);
                    if (message.find('.' + arrowClass).length === 0) {
                        const arrowElement = $('<div class="mes_button ' + arrowClass + '" title="Свернуть/развернуть сообщение"><i class="fas fa-chevron-up"></i></div>');
                        const buttonsContainer = message.find('.mes_buttons');
                        if (buttonsContainer.length) {
                            buttonsContainer.prepend(arrowElement);
                        } else {
                            message.prepend(arrowElement);
                        }
                    }
                }
            }
        }
    });
    _collapserObserver.observe(chat, { childList: true });
}

export function stopObserver() {
    if (_collapserObserver) {
        _collapserObserver.disconnect();
        _collapserObserver = null;
    }
}

// Function to remove collapse/expand arrows from messages
export function removeCollapseArrowsFromMessages() {
    console.log("Message Collapser: Removing collapse arrows.");
    // Expand all collapsed messages before removing arrows
    $('.' + collapsedClass).each(function() {
        $(this).find('.mes_text').show();
        $(this).removeClass(collapsedClass);
    });
    $('.' + arrowClass).remove();
    stopObserver();
}

// Handler for clicking an arrow
export function handleArrowClick(event) {
    const arrowSpan = $(this);
    const icon = arrowSpan.find('i');
    const message = arrowSpan.closest('.mes');
    const messageText = message.find('.mes_text');

    messageText.toggle();
    message.toggleClass(collapsedClass);

    if (messageText.is(':visible')) {
        icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
    } else {
        icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
    }
}

export function handleCollapseDisabledClick() {
    const disabledSelectorString = "$('.mes_unhide.fa-eye-slash:visible').closest('.mes')";
    const $disabledMessages = $('.mes_unhide.fa-eye-slash:visible').closest('.mes');
    const $allMessages = $('.mes');


    if ($disabledMessages.length === 0) {
        toastr.info("No 'hidden' messages (with visible .mes_unhide.fa-eye-slash) found to collapse.");
        return;
    }

    let count = 0;
    $disabledMessages.each(function(index) {
        const message = $(this);

        const messageText = message.find('.mes_text');
        const arrowSpan = message.find('.' + arrowClass);
        const icon = arrowSpan.find('i');

        messageText.hide();
        message.addClass(collapsedClass);
        if (arrowSpan.length && icon.length) {
            icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
        }
        count++;
    });

    if (count > 0) {
        toastr.success(count + (count === 1 ? " 'hidden' message collapsed." : " 'hidden' messages collapsed."));
    } else {
        toastr.info("No 'hidden' messages found to collapse (post-loop check).");
    }
}

export function handleExpandDisabledClick() {
    const disabledSelectorString = "$('.mes_unhide.fa-eye-slash:visible').closest('.mes')";
    const $disabledMessages = $('.mes_unhide.fa-eye-slash:visible').closest('.mes');
    const $allMessages = $('.mes');


    if ($disabledMessages.length === 0) {
        toastr.info("No 'hidden' messages (with visible .mes_unhide.fa-eye-slash) found to expand.");
        return;
    }

    let count = 0;
    $disabledMessages.each(function(index) {
        const message = $(this);

        const messageText = message.find('.mes_text');
        const arrowSpan = message.find('.' + arrowClass);
        const icon = arrowSpan.find('i');

        messageText.show();
        message.removeClass(collapsedClass);
        if (arrowSpan.length && icon.length) {
            icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
        }
        count++;
    });

    if (count > 0) {
        toastr.success(count + (count === 1 ? " 'hidden' message expanded." : " 'hidden' messages expanded."));
    } else {
        toastr.info("No 'hidden' messages found to expand (post-loop check).");
    }
}

export function handleExpandAllClick() {
    console.log("Message Collapser: Expanding all messages.");
    let count = 0;
    $('.mes').each(function() {
        const message = $(this);
        if (message.find('.mes_text').is(':hidden') || message.hasClass(collapsedClass)) {
            const messageText = message.find('.mes_text');
            const arrowSpan = message.find('.' + arrowClass);
            const icon = arrowSpan.find('i');

            messageText.show();
            message.removeClass(collapsedClass);
            if (arrowSpan.length && icon.length) {
                icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            }
            count++;
        }
    });
    if (count > 0) {
        toastr.success(count + (count === 1 ? " message expanded." : " messages expanded."));
    } else {
        toastr.info("All messages already expanded or no messages to expand.");
    }
}

export function handleCollapseAllClick() {
    console.log("Message Collapser: Collapsing all messages.");
    let count = 0;
    $('.mes').each(function() {
        const message = $(this);
        if (message.find('.mes_text').is(':visible') || !message.hasClass(collapsedClass)) {
            const messageText = message.find('.mes_text');
            const arrowSpan = message.find('.' + arrowClass);
            const icon = arrowSpan.find('i');

            messageText.hide();
            message.addClass(collapsedClass);
            if (arrowSpan.length && icon.length) {
                icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
            }
            count++;
        }
    });
    if (count > 0) {
        toastr.success(count + (count === 1 ? " message collapsed." : " messages collapsed."));
    } else {
        toastr.info("All messages already collapsed or no messages to collapse.");
    }
}
