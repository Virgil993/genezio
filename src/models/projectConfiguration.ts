export enum TriggerType {
  jsonrpc = "jsonrpc",
  cron = "cron",
  http = "http",
}

export enum JsRuntime {
  browser = "browser",
  node = "node",
}

export enum Language {
  js = "js",
  ts = "ts"
}

export class SdkConfiguration {
  language: Language
  runtime: JsRuntime
  path: string

  constructor(language: Language, runtime: JsRuntime, path: string) {
    this.language = language
    this.runtime = runtime
    this.path = path
  }
}

export class MethodConfiguration {
  name: string
  type: TriggerType
  cronString?: string

  constructor(name: string, type?: TriggerType, cronString?: string) {
    this.name = name
    this.type = type ?? TriggerType.jsonrpc
    this.cronString = cronString
  }

  static async create(methodConfigurationYaml: any, classType: TriggerType): Promise<MethodConfiguration> {
    if (!methodConfigurationYaml.name) {
      throw new Error("Missing method name in configuration file.")
    }

    if (methodConfigurationYaml.type && !TriggerType[methodConfigurationYaml.type as keyof typeof TriggerType]) {
      throw new Error("The method's type is incorrect.")
    }

    let type = classType
    if (methodConfigurationYaml.type) {
      type = TriggerType[methodConfigurationYaml.type as keyof typeof TriggerType]
    }

    if (type == TriggerType.cron && !methodConfigurationYaml.cronString) {
      throw new Error("The cron method is missing a cron string property.")
    }

    return new MethodConfiguration(
      methodConfigurationYaml.name,
      type,
      methodConfigurationYaml.cronString
    )
  }
}

export class ClassConfiguration {
  path: string
  type: TriggerType
  methods: MethodConfiguration[]

  constructor(path: string, type: TriggerType, methods: MethodConfiguration[]) {
    this.path = path
    this.type = type
    this.methods = methods
  }

  static async create(classConfigurationYaml: any): Promise<ClassConfiguration> {
    if (!classConfigurationYaml.path) {
      throw new Error("Path is missing from class.")
    }

    if (classConfigurationYaml.type && !TriggerType[classConfigurationYaml.type as keyof typeof TriggerType]) {
      throw new Error("The type is incorrect.")
    }

    let triggerType = TriggerType.jsonrpc

    if (classConfigurationYaml.type) {
      triggerType = TriggerType[classConfigurationYaml.type as keyof typeof TriggerType]
    }
    
    const unparsedMethods: any[] = classConfigurationYaml.methods || []
    const methods = await Promise.all(unparsedMethods.map((method: any) => MethodConfiguration.create(method, triggerType)))

    return new ClassConfiguration(
      classConfigurationYaml.path,
      triggerType,
      methods
    )
  }
}

export class ProjectConfiguration {
  name: string
  sdk: SdkConfiguration
  classes: ClassConfiguration[]

  constructor(name: string, sdk: SdkConfiguration, classes: ClassConfiguration[]) {
    this.name = name
    this.sdk = sdk
    this.classes = classes
  }

  static async create(configurationFileContent: any): Promise<ProjectConfiguration> {
    if (!configurationFileContent.name) {
      throw new Error("The name property is missing from the configuration file.")
    }

    if (!configurationFileContent.sdk.path) {
      throw new Error("The sdk.path property is missing from the configuration file.")
    }

    const language: string = configurationFileContent.sdk.language

    if (!language || !Language[language as keyof typeof Language]) {
      throw new Error("The sdk.language property is invalid.")
    }

    if ((Language[configurationFileContent.sdk.language as keyof typeof Language] == Language.js ||
      Language[configurationFileContent.sdk.language as keyof typeof Language] == Language.ts) &&
      !JsRuntime[configurationFileContent.sdk.runtime as keyof typeof JsRuntime]) {
        throw new Error("The sdk.runtime property is invalid.")
      }
    
    const sdk = new SdkConfiguration(
      Language[configurationFileContent.sdk.language as keyof typeof Language],
      JsRuntime[configurationFileContent.sdk.runtime as keyof typeof JsRuntime],
      configurationFileContent.sdk.path
    )

    const unparsedClasses: any[] = configurationFileContent.classes

    if (!unparsedClasses) {
      throw new Error("The configuration file should contain at least one class.")
    }

    const classes = await Promise.all(unparsedClasses.map((c) => ClassConfiguration.create(c)))

    return new ProjectConfiguration(
      configurationFileContent.name,
      sdk,
      classes
    )
  }
}