"""Everything that runs on a schedule rather than per request.

Fetches live data from the FPL API, Understat and the Guardian, rebuilds the
training features from it, and runs the trained models. This used to live under
`ml/pipelines/inference/`, which put serving code inside the training package
and left two different modules called "inference".

`ml/` trains models. This package uses them.
"""
