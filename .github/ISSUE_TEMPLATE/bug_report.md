name: Report an issue
description: Report an issue with one of FaserF's Custom Addon's
title: "[Bug]: "
labels: ["bug"]
assignees:
  - FaserF
body:
  - type: markdown
    attributes:
      value: |
        This issue form is for reporting bugs only!

        If you have a feature or enhancement request, please use the feature request template!
  - type: textarea
    validations:
      required: true
    attributes:
      label: The problem
      description: >-
        Describe the issue you are experiencing here, to communicate to the
        maintainers. Tell us what you were trying to do and what happened.

        Provide a clear and concise description of what the problem is.
  - type: markdown
    attributes:
      value: |
        ## Environment
  - type: input
    id: version
    validations:
      required: true
    attributes:
      label: What version of Home Assistant Core has the issue?
      placeholder: core-
      description: >
        Can be found in: [Settings -> About](https://my.home-assistant.io/redirect/info/).

        [![Open your Home Assistant instance and show your Home Assistant version information.](https://my.home-assistant.io/badges/info.svg)](https://my.home-assistant.io/redirect/info/)
  - type: input
    attributes:
      label: What was the last working version of Home Assistant Core?
      placeholder: core-
      description: >
        If known, otherwise leave blank.
  - type: dropdown
    validations:
      required: true
    attributes:
      label: What type of installation are you running?
      description: >
        Can be found in: [Settings -> About](https://my.home-assistant.io/redirect/info/).

        [![Open your Home Assistant instance and show your Home Assistant version information.](https://my.home-assistant.io/badges/info.svg)](https://my.home-assistant.io/redirect/info/)
      options:
        - Home Assistant OS
        - Home Assistant Container
        - Home Assistant Supervised
        - Home Assistant Core
  - type: input
    id: integration_name
    attributes:
      label: Add-On causing the issue
      description: >
        The name of the Addon. For example: Apache2
  - type: markdown
    attributes:
      value: |
        # Details
  - type: textarea
    attributes:
      label: Log information
      render: txt
      description: >-
        Please go to the addon within your Homeassistant Instance -> Log and copy the output here
  - type: textarea
    attributes:
      label: Additional information
      description: >
        If you have any additional information for us, use the field below.