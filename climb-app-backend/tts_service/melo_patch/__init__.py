# CPT208 Melo runtime patch
from importlib import import_module

from .symbols import *


_symbol_to_id = {s: i for i, s in enumerate(symbols)}


def cleaned_text_to_sequence(cleaned_text, tones, language, symbol_to_id=None):
    symbol_to_id_map = symbol_to_id if symbol_to_id else _symbol_to_id
    phones = [symbol_to_id_map[symbol] for symbol in cleaned_text]
    tone_start = language_tone_start_map[language]
    tones = [i + tone_start for i in tones]
    lang_id = language_id_map[language]
    lang_ids = [lang_id for _ in phones]
    return phones, tones, lang_ids


def get_bert(norm_text, word2ph, language, device):
    module_path_map = {
        "ZH": ".chinese_bert",
        "EN": ".english_bert",
        "JP": ".japanese_bert",
        "ZH_MIX_EN": ".chinese_mix",
        "FR": ".french_bert",
        "SP": ".spanish_bert",
        "ES": ".spanish_bert",
        "KR": ".korean",
    }

    if language not in module_path_map:
        raise KeyError(f"Unsupported language for bert features: {language}")

    module = import_module(module_path_map[language], package=__package__)
    return module.get_bert_feature(norm_text, word2ph, device)
