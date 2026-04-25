"""Evaluation dataset: YouTube videos with labeled Q&A pairs.

Each question has an `expected_substring` — a distinctive phrase from the
transcript that the answer-bearing chunk must contain. A retrieval is a
"hit" at rank k if any of the top-k retrieved chunks contains the substring.

Substrings are chosen to be:
  - distinctive (unlikely to appear outside the answer location)
  - short (so whitespace/punctuation normalization works)
  - lowercased for case-insensitive matching

The dataset covers 4 real YouTube videos across ML, programming, and science
domains to avoid domain-specific bias.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EvalQuestion:
    """A single labeled question for retrieval evaluation."""

    question: str
    expected_substring: str  # lowercased; must appear in the correct chunk


@dataclass(frozen=True)
class EvalVideo:
    """A video with a set of labeled questions."""

    video_id: str
    title: str
    questions: tuple[EvalQuestion, ...]


# Real YouTube video IDs. English transcripts are available for all of these
# (verified at time of dataset construction). Questions are labeled with
# distinctive phrases expected to appear in the transcript chunk containing
# the answer.
EVAL_DATASET: tuple[EvalVideo, ...] = (
    EvalVideo(
        video_id="aircAruvnKk",
        title="3Blue1Brown — But what is a neural network?",
        questions=(
            EvalQuestion(
                question="What does each neuron in the network hold?",
                expected_substring="a number",
            ),
            EvalQuestion(
                question="How many neurons are in the first layer?",
                expected_substring="784",
            ),
            EvalQuestion(
                question="What is the activation of a neuron?",
                expected_substring="activation",
            ),
            EvalQuestion(
                question="How are layers connected in the network?",
                expected_substring="weight",
            ),
            EvalQuestion(
                question="What is the sigmoid function used for?",
                expected_substring="sigmoid",
            ),
        ),
    ),
    EvalVideo(
        video_id="IHZwWFHWa-w",
        title="3Blue1Brown — Gradient descent, how neural networks learn",
        questions=(
            EvalQuestion(
                question="What is the cost function?",
                expected_substring="cost",
            ),
            EvalQuestion(
                question="What does gradient descent minimize?",
                expected_substring="minimum",
            ),
            EvalQuestion(
                question="How is the gradient related to the direction of steepest descent?",
                expected_substring="steepest",
            ),
            EvalQuestion(
                question="What are the parameters adjusted during learning?",
                expected_substring="weights and biases",
            ),
            EvalQuestion(
                question="What happens if the cost function lands in a local minimum?",
                expected_substring="local minimum",
            ),
        ),
    ),
    EvalVideo(
        video_id="kCc8FmEb1nY",
        title="Andrej Karpathy — Let's build GPT from scratch",
        questions=(
            EvalQuestion(
                question="What tokenizer does the implementation use?",
                expected_substring="character",
            ),
            EvalQuestion(
                question="What dataset is used for training the mini GPT?",
                expected_substring="shakespeare",
            ),
            EvalQuestion(
                question="What is self-attention?",
                expected_substring="attention",
            ),
            EvalQuestion(
                question="What are query, key and value vectors?",
                expected_substring="query",
            ),
            EvalQuestion(
                question="Why do we scale the dot products in attention?",
                expected_substring="scale",
            ),
        ),
    ),
    EvalVideo(
        video_id="LPZh9BOjkQs",
        title="3Blue1Brown — Large Language Models explained briefly",
        questions=(
            EvalQuestion(
                question="How long would it take a human to read GPT-3's training data?",
                expected_substring="2600 years",
            ),
            EvalQuestion(
                question="What are the parameters of a language model?",
                expected_substring="parameters or weights",
            ),
            EvalQuestion(
                question="What algorithm is used to tweak the model's parameters during training?",
                expected_substring="backpropagation",
            ),
            EvalQuestion(
                question="What extra training step turns a pre-trained model into a helpful assistant?",
                expected_substring="reinforcement learning",
            ),
            EvalQuestion(
                question="What special operation makes transformers unique?",
                expected_substring="attention",
            ),
        ),
    ),
)


def all_questions() -> list[tuple[str, EvalQuestion]]:
    """Return a flat list of (video_id, question) tuples."""
    return [(v.video_id, q) for v in EVAL_DATASET for q in v.questions]


def total_questions() -> int:
    """Return the total number of labeled questions in the dataset."""
    return sum(len(v.questions) for v in EVAL_DATASET)
