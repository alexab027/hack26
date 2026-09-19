"""Central raw AudioSet label to user-facing semantic cue configuration."""

# Exact source labels verified against config.id2label for:
# MIT/ast-finetuned-audioset-10-10-0.4593
SEMANTIC_ALIAS_GROUPS: dict[str, tuple[str, ...]] = {
    "laughter": (
        "Laughter",
        "Giggle",
        "Snicker",
        "Chuckle, chortle",
        "Belly laugh",
        "Baby laughter",
    ),
    "crying": ("Crying, sobbing", "Baby cry, infant cry", "Whimper"),
    "chatter": (
        "Conversation",
        "Chatter",
        "Babbling",
        "Hubbub, speech noise, speech babble",
    ),
    "car_horn": ("Vehicle horn, car horn, honking", "Air horn, truck horn"),
    "shout": ("Shout", "Yell", "Children shouting"),
    "whispering": ("Whispering",),
    "sigh": ("Sigh",),
    "humming": ("Humming",),
    "groan": ("Groan",),
    "breathing": ("Breathing",),
    "wheeze": ("Wheeze",),
    "gasp": ("Gasp",),
    "pant": ("Pant",),
    "cough": ("Cough",),
    "throat_clearing": ("Throat clearing",),
    "sneeze": ("Sneeze",),
    "sniff": ("Sniff",),
    "background_music": ("Background music",),
    "siren": (
        "Siren",
        "Civil defense siren",
        "Police car (siren)",
        "Ambulance (siren)",
        "Fire engine, fire truck (siren)",
    ),
    "door_knock": ("Knock",),
    "dog_bark": (
        "Dog",
        "Bark",
        "Bow-wow",
        "Whimper (dog)",
        "Canidae, dogs, wolves",
    ),
    "applause": ("Applause", "Clapping"),
    "phone_ringing": ("Telephone bell ringing", "Ringtone"),
}


def _build_raw_label_index() -> dict[str, str]:
    index: dict[str, str] = {}
    for semantic_label, raw_labels in SEMANTIC_ALIAS_GROUPS.items():
        for raw_label in raw_labels:
            if raw_label in index:
                raise ValueError(
                    f"Raw AudioSet label {raw_label!r} belongs to both "
                    f"{index[raw_label]!r} and {semantic_label!r}"
                )
            index[raw_label] = semantic_label
    return index


RAW_LABEL_TO_SEMANTIC = _build_raw_label_index()
