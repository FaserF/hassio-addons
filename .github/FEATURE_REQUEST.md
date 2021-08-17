name: Report a feature request / idea for one of the add-ons
about: Report a feature request for one of the add-ons in this repository
labels: enhancement
assignees: FaserF
body:
  - type: markdown
    attributes:
      value: |
        This issue form is for feature requests / ideas only!

        If you have a issue, please use the bug template.

  - type: textarea
    validations:
      required: true
    attributes:
      label: The feature request / idea
      description: >-
        Describe the the idea of your feature request

        Provide a clear and concise description of what the idea is.
  - type: markdown
    attributes:
      value: |
        # Details
  - type: dropdown
    validations:
      required: true
    attributes:
      label: For what addon is the feature request?
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
  - type: textarea
    attributes:
      label: Additional information
      description: >
        If you have any additional information for us, use the field below.
        Please note, you can attach screenshots or screen recordings here, by
        dragging and dropping files in the field below.