"""
Paquete de modelos SQLAlchemy.

Importa todos los modelos para que SQLAlchemy los registre
automáticamente al hacer `from .models import *` o al importar
el paquete.
"""

from .portafolio import Portafolio, Posicion, Transaccion  # noqa: F401
from .alerta import Alerta, AlertaHistorial  # noqa: F401
from .noticia import Noticia  # noqa: F401
from .widget import WidgetConfig  # noqa: F401
from .cache import PrecioCache, InpcCache, TipoCambioCache, CicloCache  # noqa: F401
from .universo import UniversoTicker  # noqa: F401
from .simulacion import Simulacion, SimulacionActivo  # noqa: F401
from .configuracion import ConfiguracionUsuario  # noqa: F401
