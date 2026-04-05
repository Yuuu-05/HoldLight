# CPT208 Melo runtime patch
import os
import re

import cn2an
import jieba.posseg as psg
from pypinyin import Style, lazy_pinyin

from .chinese import _g2p as _chinese_g2p
from .english_light import g2p as g2p_en
from .symbols import language_tone_start_map
from .tone_sandhi import ToneSandhi

punctuation = ["!", "?", ",", ".", "'", "-"]
current_file_path = os.path.dirname(__file__)
pinyin_to_symbol_map = {
    line.split("\t")[0]: line.strip().split("\t")[1]
    for line in open(os.path.join(current_file_path, "opencpop-strict.txt"), encoding="utf-8").readlines()
}


class BasicMixedTokenizer:
    _token_pattern = re.compile(r"[a-z]+|[0-9]+|[^a-z0-9\s]", re.IGNORECASE)

    def tokenize(self, text):
        return self._token_pattern.findall((text or "").lower())


tokenizer = BasicMixedTokenizer()
tone_modifier = ToneSandhi()
rep_map = {
    "\n": ".",
    ";": ",",
    ":": ",",
    "...": ".",
    "$": ".",
    "~": "-",
}


def replace_punctuation(text):
    pattern = re.compile("|".join(re.escape(p) for p in rep_map.keys()))
    replaced_text = pattern.sub(lambda x: rep_map[x.group()], text)
    replaced_text = re.sub(r"[^\u4e00-\u9fa5_a-zA-Z\s" + "".join(re.escape(p) for p in punctuation) + r"]+", "", replaced_text)
    replaced_text = re.sub(r"[\s]+", " ", replaced_text)
    return replaced_text


def _get_initials_finals(word):
    initials = []
    finals = []
    orig_initials = lazy_pinyin(word, neutral_tone_with_five=True, style=Style.INITIALS)
    orig_finals = lazy_pinyin(word, neutral_tone_with_five=True, style=Style.FINALS_TONE3)
    for current_initial, current_final in zip(orig_initials, orig_finals):
        initials.append(current_initial)
        finals.append(current_final)
    return initials, finals


def text_normalize(text):
    numbers = re.findall(r"\d+(?:\.?\d+)?", text or "")
    normalized_text = text or ""
    for number in numbers:
        normalized_text = normalized_text.replace(number, cn2an.an2cn(number), 1)
    return replace_punctuation(normalized_text)


def g2p(text, impl="v2"):
    pattern = r"(?<=[{0}])\s*".format("".join(re.escape(p) for p in punctuation))
    sentences = [segment for segment in re.split(pattern, text) if segment.strip()]

    if impl == "v1":
        convert_func = _g2p
    elif impl == "v2":
        convert_func = _g2p_v2
    else:
        raise NotImplementedError()

    phones, tones, word2ph = convert_func(sentences)
    phones = ["_"] + phones + ["_"]
    tones = [0] + tones + [0]
    word2ph = [1] + word2ph + [1]
    return phones, tones, word2ph


def _g2p(segments):
    phones_list = []
    tones_list = []
    word2ph = []
    for segment in segments:
        seg_cut = tone_modifier.pre_merge_for_modify(psg.lcut(segment))
        initials = []
        finals = []
        for word, pos in seg_cut:
            if pos == "eng":
                initials.append(["EN_WORD"])
                finals.append([word])
            else:
                sub_initials, sub_finals = _get_initials_finals(word)
                sub_finals = tone_modifier.modified_tone(word, pos, sub_finals)
                initials.append(sub_initials)
                finals.append(sub_finals)

        initials = sum(initials, [])
        finals = sum(finals, [])
        for current_initial, current_final in zip(initials, finals):
            if current_initial == "EN_WORD":
                tokenized_en = tokenizer.tokenize(current_final)
                phones_en, tones_en, word2ph_en = g2p_en(text=None, pad_start_end=False, tokenized=tokenized_en)
                tones_en = [tone + language_tone_start_map["EN"] for tone in tones_en]
                phones_list += phones_en
                tones_list += tones_en
                word2ph += word2ph_en
                continue

            if current_initial == current_final:
                phone = [current_initial]
                tone = "0"
                word2ph.append(1)
            else:
                final_without_tone = current_final[:-1]
                tone = current_final[-1]
                pinyin = current_initial + final_without_tone

                if current_initial:
                    final_replacement_map = {
                        "uei": "ui",
                        "iou": "iu",
                        "uen": "un",
                    }
                    if final_without_tone in final_replacement_map:
                        pinyin = current_initial + final_replacement_map[final_without_tone]
                else:
                    pinyin_replacement_map = {
                        "ing": "ying",
                        "i": "yi",
                        "in": "yin",
                        "u": "wu",
                    }
                    if pinyin in pinyin_replacement_map:
                        pinyin = pinyin_replacement_map[pinyin]
                    else:
                        single_replacement_map = {
                            "v": "yu",
                            "e": "e",
                            "i": "y",
                            "u": "w",
                        }
                        if pinyin and pinyin[0] in single_replacement_map:
                            pinyin = single_replacement_map[pinyin[0]] + pinyin[1:]

                phone = pinyin_to_symbol_map[pinyin].split(" ")
                word2ph.append(len(phone))

            phones_list += phone
            tones_list += [int(tone)] * len(phone)

    return phones_list, tones_list, word2ph


def _g2p_v2(segments):
    split_marker = "#$&^!@"
    phones_list = []
    tones_list = []
    word2ph = []

    for text in segments:
        text = re.sub(r"([a-zA-Z\s]+)", lambda match: f"{split_marker}{match.group(1)}{split_marker}", text)
        parts = [part for part in text.split(split_marker) if part]

        for part in parts:
            if re.fullmatch(r"[a-zA-Z\s]+", part):
                tokenized_en = tokenizer.tokenize(part)
                phones_en, tones_en, word2ph_en = g2p_en(text=None, pad_start_end=False, tokenized=tokenized_en)
                tones_en = [tone + language_tone_start_map["EN"] for tone in tones_en]
                phones_list += phones_en
                tones_list += tones_en
                word2ph += word2ph_en
            else:
                phones_zh, tones_zh, word2ph_zh = _chinese_g2p([part])
                phones_list += phones_zh
                tones_list += tones_zh
                word2ph += word2ph_zh

    return phones_list, tones_list, word2ph


def get_bert_feature(text, word2ph, device):
    from . import chinese_bert

    return chinese_bert.get_bert_feature(text, word2ph, model_id="bert-base-multilingual-uncased", device=device)
