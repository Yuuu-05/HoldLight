# CPT208 Melo runtime patch
import os
import pickle
import re

try:
    from g2p_en import G2p
except Exception:
    G2p = None

from . import symbols
from .english_utils.abbreviations import expand_abbreviations
from .english_utils.number_norm import normalize_numbers
from .english_utils.time_norm import expand_time_english

current_file_path = os.path.dirname(__file__)
CMU_DICT_PATH = os.path.join(current_file_path, "cmudict.rep")
CACHE_PATH = os.path.join(current_file_path, "cmudict_cache.pickle")


class BasicEnglishTokenizer:
    _token_pattern = re.compile(r"[a-z]+|[0-9]+|[^a-z0-9\s]", re.IGNORECASE)

    def tokenize(self, text):
        return self._token_pattern.findall((text or "").lower())


tokenizer = BasicEnglishTokenizer()
_g2p = None
if G2p is not None:
    try:
        _g2p = G2p()
    except Exception:
        _g2p = None


arpa = {
    "AH0",
    "S",
    "AH1",
    "EY2",
    "AE2",
    "EH0",
    "OW2",
    "UH0",
    "NG",
    "B",
    "G",
    "AY0",
    "M",
    "AA0",
    "F",
    "AO0",
    "ER2",
    "UH1",
    "IY1",
    "AH2",
    "DH",
    "IY0",
    "EY1",
    "IH0",
    "K",
    "N",
    "W",
    "IY2",
    "T",
    "AA1",
    "ER1",
    "EH2",
    "OY0",
    "UH2",
    "UW1",
    "Z",
    "AW2",
    "AW1",
    "V",
    "UW2",
    "AA2",
    "ER",
    "AW0",
    "UW0",
    "R",
    "OW1",
    "EH1",
    "ZH",
    "AE0",
    "IH2",
    "IH",
    "Y",
    "JH",
    "P",
    "AY1",
    "EY0",
    "OY2",
    "TH",
    "HH",
    "D",
    "ER0",
    "CH",
    "AO1",
    "AE1",
    "AO2",
    "OY1",
    "AY2",
    "IH1",
    "OW0",
    "L",
    "SH",
}


def distribute_phone(n_phone, n_word):
    if n_word <= 0:
        return [n_phone]

    phones_per_word = [0] * n_word
    for _ in range(n_phone):
        min_tasks = min(phones_per_word)
        min_index = phones_per_word.index(min_tasks)
        phones_per_word[min_index] += 1
    return phones_per_word


def post_replace_ph(ph):
    rep_map = {
        ";": ",",
        ":": ",",
        "\n": ".",
        "...": ".",
    }
    ph = rep_map.get(ph, ph)
    if ph in symbols:
        return ph
    return "UNK"


def read_dict():
    g2p_dict = {}
    start_line = 49
    with open(CMU_DICT_PATH, encoding="utf-8") as dictionary_file:
        line = dictionary_file.readline()
        line_index = 1
        while line:
            if line_index >= start_line:
                line = line.strip()
                if line:
                    word_split = line.split("  ")
                    word = word_split[0]
                    syllable_split = word_split[1].split(" - ")
                    g2p_dict[word] = [syllable.split(" ") for syllable in syllable_split]

            line_index += 1
            line = dictionary_file.readline()

    return g2p_dict


def cache_dict(g2p_dict, file_path):
    with open(file_path, "wb") as pickle_file:
        pickle.dump(g2p_dict, pickle_file)


def get_dict():
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "rb") as pickle_file:
            return pickle.load(pickle_file)

    g2p_dict = read_dict()
    cache_dict(g2p_dict, CACHE_PATH)
    return g2p_dict


eng_dict = get_dict()


def refine_ph(phn):
    tone = 0
    if re.search(r"\d$", phn):
        tone = int(phn[-1]) + 1
        phn = phn[:-1]
    return phn.lower(), tone


def refine_syllables(syllables):
    tones = []
    phonemes = []
    for phn_list in syllables:
        for phn in phn_list:
            refined_phn, tone = refine_ph(phn)
            phonemes.append(refined_phn)
            tones.append(tone)
    return phonemes, tones


def fallback_word_to_phones(word):
    phones = []
    tones = []

    if _g2p is not None:
        phone_list = list(filter(lambda p: p != " ", _g2p(word)))
        for ph in phone_list:
            if ph in arpa:
                refined_ph, tone = refine_ph(ph)
                phones.append(refined_ph)
                tones.append(tone)
            else:
                phones.append(post_replace_ph(ph))
                tones.append(0)
        return phones, tones

    for char in word:
        if char.upper() in eng_dict:
            char_phones, char_tones = refine_syllables(eng_dict[char.upper()])
            phones += char_phones
            tones += char_tones
        elif char in {",", ".", "!", "?", "-", "'"}:
            phones.append(post_replace_ph(char))
            tones.append(0)
        elif char.strip():
            phones.append("UNK")
            tones.append(0)

    if not phones:
        phones = ["UNK"]
        tones = [0]

    return phones, tones


def text_normalize(text):
    text = (text or "").lower()
    text = expand_time_english(text)
    text = normalize_numbers(text)
    text = expand_abbreviations(text)
    return text


def g2p(text, pad_start_end=True, tokenized=None):
    tokens = tokenized if tokenized is not None else tokenizer.tokenize(text)
    ph_groups = []
    for token in tokens:
        if not token.startswith("#"):
            ph_groups.append([token])
        elif ph_groups:
            ph_groups[-1].append(token.replace("#", ""))
        else:
            ph_groups.append([token.replace("#", "")])

    phones = []
    tones = []
    word2ph = []
    for group in ph_groups:
        word = "".join(group)
        if not word:
            continue

        phone_len = 0
        if word.upper() in eng_dict:
            phns, tns = refine_syllables(eng_dict[word.upper()])
            phones += phns
            tones += tns
            phone_len += len(phns)
        else:
            fallback_phones, fallback_tones = fallback_word_to_phones(word)
            phones += fallback_phones
            tones += fallback_tones
            phone_len += len(fallback_phones)

        word2ph += distribute_phone(phone_len, max(1, len(group)))

    phones = [post_replace_ph(phone) for phone in phones]

    if pad_start_end:
        phones = ["_"] + phones + ["_"]
        tones = [0] + tones + [0]
        word2ph = [1] + word2ph + [1]

    return phones, tones, word2ph


def get_bert_feature(text, word2ph, device=None):
    from text import english_bert

    return english_bert.get_bert_feature(text, word2ph, device=device)
