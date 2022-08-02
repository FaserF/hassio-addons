name: Report a bug with one of the add-ons
about: Report an issue with one of the add-ons in this repository
labels: bug
assignees: FaserF
body:
- type: markdown
    attributes:
      value: |
        This issue form is for reporting bugs only!

        If you have a feature or enhancement request, please use the feature request template.

- type: textarea
    validations:
      required: true
    attributes:
      label: The problem
      description: >-
        Describe the issue you are experiencing here to communicate to the
        maintainers. Tell us what you were trying to do and what happened.

        Provide a clear and concise description of what the problem is.
- type: markdown
    attributes:
      value: |
        ## Environment
- type: dropdown
    validations:
      required: true
    attributes:
      label: What Addon has the issue?
      options:
        - Apache2-Minimal-MariaDB
        - Apache2-Minimal
        - Apache2
        - Bash_Script_Executer
        - BT-MQTT-Gateway
        - Freenom-DNS-Updater
        - Netboot-XYZ
        - OpenSSL
        - Switch_LAN_Play
        - Switch_LAN_Play_Server
        - Tuya-Convert
        - Wiki.JS
        - xqrepack
        - Other
- type: input
    id: version
    validations:
      required: true
    attributes:
      label: What version of the addon has the issue?
      placeholder: 1.2.3
      description: >
        Can be found in the Supervisor panel -> Addons -> AddonName -> Version.
- type: input
    attributes:
      label: What was the last working version of Addon?
      placeholder: 1.2.3
      description: >
        If known, otherwise leave blank.
- type: dropdown
    validations:
      required: true
    attributes:
      label: What type of installation are you running?
      description: >
        If you don't know, you can find it in: Configuration panel -> Info.
      options:
        - Home Assistant OS
        - Home Assistant Supervised
        - Other
- type: markdown
    attributes:
      value: |
        # Details
- type: textarea
    attributes:
      label: Anything in the logs that might be useful for us?
      description: For example, error message, or stack traces.
      render: txt
- type: textarea
    attributes:
      label: Additional information
      description: >
        If you have any additional information for us, use the field below.
        Please note, you can attach screenshots or screen recordings here, by
        dragging and dropping files in the field below.