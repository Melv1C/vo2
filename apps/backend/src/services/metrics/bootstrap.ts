import { runningModule } from "./pace";
import { cyclingModule } from "./power";
import { registerSportModule, registerUniversalModule } from "./registry";
import { universalModule } from "./trimp";

registerUniversalModule(universalModule);
registerSportModule(cyclingModule);
registerSportModule(runningModule);
