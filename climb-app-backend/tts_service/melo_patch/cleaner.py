# CPT208 Melo runtime patch
from importlib import import_module
import copy

from . import cleaned_text_to_sequence

LANGUAGE_MODULE_PATHS = {
    "ZH": ".chinese",
    "JP": ".japanese",
    "EN": ".english_light",
    "ZH_MIX_EN": ".chinese_mix_light",
    "KR": ".korean",
    "FR": ".french",
    "SP": ".spanish",
    "ES": ".spanish",
}

_language_module_cache = {}


def get_language_module(language):
    if language not in LANGUAGE_MODULE_PATHS:
        raise KeyError(f"Unsupported language: {language}")

    if language not in _language_module_cache:
        _language_module_cache[language] = import_module(LANGUAGE_MODULE_PATHS[language], package=__package__)

    return _language_module_cache[language]


def clean_text(text, language):
    language_module = get_language_module(language)
    norm_text = language_module.text_normalize(text)
    phones, tones, word2ph = language_module.g2p(norm_text)
    return norm_text, phones, tones, word2ph


def clean_text_bert(text, language, device=None):
    language_module = get_language_module(language)
    norm_text = language_module.text_normalize(text)
    phones, tones, word2ph = language_module.g2p(norm_text)

    word2ph_bak = copy.deepcopy(word2ph)
    for i in range(len(word2ph)):
        word2ph[i] = word2ph[i] * 2
    word2ph[0] += 1
    bert = language_module.get_bert_feature(norm_text, word2ph, device=device)

    return norm_text, phones, tones, word2ph_bak, bert


def text_to_sequence(text, language):
    norm_text, phones, tones, word2ph = clean_text(text, language)
    return cleaned_text_to_sequence(phones, tones, language)
